import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Event, Booking, CustomField, QueueSession, LineSettings } from '../../lib/database.types'
import { exportToExcel, exportToGoogleSheets } from '../../lib/export'
import type { BookingWithProfile } from '../../lib/database.types'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { QRCodeCanvas } from 'qrcode.react'
import toast from 'react-hot-toast'
import './EventDetailPage.css'

type Tab = 'bookings' | 'settings' | 'qr' | 'line' | 'activities'

const STATUS_LABELS: Record<Booking['status'], string> = {
  waiting: 'รอเรียก',
  called: 'เรียกแล้ว',
  present: 'มาแล้ว',
  absent: 'ไม่มา',
  cancelled: 'ยกเลิก',
}

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const qrRef = useRef<HTMLCanvasElement>(null)

  const [event, setEvent] = useState<Event | null>(null)
  const [bookings, setBookings] = useState<BookingWithProfile[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [queueSession, setQueueSession] = useState<QueueSession | null>(null)
  const [lineSettings, setLineSettings] = useState<LineSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('bookings')
  const [bookingSearch, setBookingSearch] = useState('')
  const [editingEvent, setEditingEvent] = useState(false)
  const [childEvents, setChildEvents] = useState<Event[]>([])
  // Inline edit for group overview
  const [editGroupTitle, setEditGroupTitle] = useState('')
  const [editGroupDesc, setEditGroupDesc] = useState('')
  const [editGroupBannerFile, setEditGroupBannerFile] = useState<File | null>(null)
  const [editGroupBannerPreview, setEditGroupBannerPreview] = useState('')
  const [editingGroupInfo, setEditingGroupInfo] = useState(false)
  const [savingGroupInfo, setSavingGroupInfo] = useState(false)

  // LINE settings state
  const [lineToken, setLineToken] = useState('')
  const [lineGroupId, setLineGroupId] = useState('')
  const [lineActive, setLineActive] = useState(false)
  const [lineNotifyCall, setLineNotifyCall] = useState(true)
  const [lineNotifyAvailable, setLineNotifyAvailable] = useState(true)
  const [lineNotifyClose, setLineNotifyClose] = useState(true)
  const [lineBeforeMinutes, setLineBeforeMinutes] = useState(5)

  const bookingUrl = `${window.location.origin}/book/${eventId}?openExternalBrowser=1`

  useEffect(() => {
    fetchAll()
  }, [eventId])

  const fetchAll = async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const [eventRes, bookingsRes, fieldsRes, sessionRes, lineRes, childrenRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('bookings').select('*, profiles(*), event_slots(*)').eq('event_id', eventId).order('queue_number'),
        supabase.from('custom_fields').select('*').eq('event_id', eventId).order('sort_order'),
        supabase.from('queue_sessions').select('*').eq('event_id', eventId).single(),
        supabase.from('line_settings').select('*').eq('event_id', eventId).maybeSingle(),
        supabase.from('events').select('*').eq('parent_id', eventId).order('created_at', { ascending: true }),
      ])

      if (eventRes.data) {
        setEvent(eventRes.data)
        if (eventRes.data.is_group) {
          if (activeTab === 'bookings' || activeTab === 'settings' || activeTab === 'line') {
            setActiveTab('activities')
          }
        } else {
          if (activeTab === 'activities') {
            setActiveTab('bookings')
          }
        }
      }
      if (bookingsRes.data) {
        const sortedBookings = (bookingsRes.data as BookingWithProfile[]).sort((a, b) => {
          if (a.event_slots && b.event_slots) {
            const dateA = a.event_slots.slot_date || ''
            const dateB = b.event_slots.slot_date || ''
            if (dateA !== dateB) return dateA.localeCompare(dateB)
            
            const timeA = a.event_slots.start_time || ''
            const timeB = b.event_slots.start_time || ''
            if (timeA !== timeB) return timeA.localeCompare(timeB)
          } else if (a.event_slots) {
            return -1
          } else if (b.event_slots) {
            return 1
          }
          return a.queue_number - b.queue_number
        })
        setBookings(sortedBookings)
      }
      if (fieldsRes.data) setCustomFields(fieldsRes.data)
      if (sessionRes.data) setQueueSession(sessionRes.data)
      if (childrenRes.data) setChildEvents(childrenRes.data)
      if (lineRes.data) {
        setLineSettings(lineRes.data)
        setLineToken(lineRes.data.channel_access_token || '')
        setLineGroupId(lineRes.data.group_id || '')
        setLineActive(lineRes.data.is_active)
        setLineNotifyCall(lineRes.data.notify_on_call)
        setLineNotifyAvailable(lineRes.data.notify_on_available)
        setLineNotifyClose(lineRes.data.notify_on_close)
        setLineBeforeMinutes(lineRes.data.notify_before_minutes)
      }
    } catch (err) {
      toast.error('ไม่สามารถโหลดข้อมูลได้')
    } finally {
      setLoading(false)
    }
  }

  const handleBookingStatusChange = async (bookingId: string, status: Booking['status']) => {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', bookingId)
    if (error) { toast.error('เกิดข้อผิดพลาด'); return }
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b))
    toast.success('อัปเดตสถานะแล้ว')
  }

  const handleClearDatabase = async () => {
    if (!confirm('⚠️ ยืนยันการลบข้อมูลการจองทั้งหมด? การดำเนินการนี้ไม่สามารถย้อนกลับได้!')) return
    const { error } = await supabase.from('bookings').delete().eq('event_id', eventId)
    if (error) { toast.error('เกิดข้อผิดพลาด'); return }
    setBookings([])
    // Reset queue session
    await supabase.from('queue_sessions').update({ current_numbers: [] }).eq('event_id', eventId)
    toast.success('ล้างข้อมูลการจองแล้ว')
  }

  const handleSaveLineSettings = async () => {
    const upsertData = {
      event_id: eventId!,
      channel_access_token: lineToken,
      group_id: lineGroupId,
      is_active: lineActive,
      notify_on_call: lineNotifyCall,
      notify_on_available: lineNotifyAvailable,
      notify_on_close: lineNotifyClose,
      notify_before_minutes: lineBeforeMinutes,
    }
    const { error } = await supabase.from('line_settings').upsert(upsertData, { onConflict: 'event_id' })
    if (error) { toast.error('เกิดข้อผิดพลาด'); return }
    toast.success('บันทึกการตั้งค่า LINE แล้ว')
  }

  const downloadQR = () => {
    const canvas = qrRef.current
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${event?.title || 'event'}.png`
    a.click()
  }

  const activeBookings = bookings.filter(b => b.status !== 'cancelled')
  const waitingCount = bookings.filter(b => b.status === 'waiting').length
  const filteredBookings = bookings.filter(b => {
    if (!bookingSearch) return true
    const q = bookingSearch.toLowerCase()
    const responses = (b.field_responses || {}) as Record<string, string>
    return (
      b.queue_number.toString().includes(q) ||
      Object.values(responses).some(v => v?.toLowerCase().includes(q))
    )
  })

  if (loading) {
    return <div className="loading-overlay"><div className="spinner spinner-lg" /><span>กำลังโหลด...</span></div>
  }

  if (!event) {
    return <div className="empty-state"><div className="empty-state-title">ไม่พบกิจกรรม</div></div>
  }

  return (
    <div className="event-detail fade-in">
      {/* Event Header */}
      <div className="event-detail-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(event.parent_id ? `/organizer/events/${event.parent_id}` : '/organizer')}>
          ← {event.parent_id ? 'กลับไปกิจกรรมหลัก' : 'กลับ'}
        </button>
        <div className="event-detail-banner">
          {event.banner_url ? (
            <img src={event.banner_url} alt={event.title} />
          ) : (
            <div className="event-detail-banner-placeholder">
              {event.title.includes('ตัดผม') ? '✂️' : event.title.includes('เล็บ') ? '💅' : event.title.includes('สุขภาพ') ? '🏥' : event.title.includes('นวด') ? '💆' : '📋'}
            </div>
          )}
        </div>
        <div className="event-detail-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <h1>{event.title}</h1>
            {event.status === 'active' && <span className="badge badge-active">● เปิดรับจอง</span>}
            {event.status === 'paused' && <span className="badge badge-paused">⏸ หยุดชั่วคราว</span>}
            {event.status === 'closed' && <span className="badge badge-closed">✕ ปิดแล้ว</span>}
          </div>
          {event.description && <p>{event.description}</p>}
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {event.is_group ? (
              <div className="detail-stat"><span>📁</span><span>{childEvents.length} กิจกรรมย่อย</span></div>
            ) : (
              <>
                <div className="detail-stat"><span>🎫</span><span>{activeBookings.length} การจอง</span></div>
                <div className="detail-stat"><span>⏳</span><span>{waitingCount} รอ</span></div>
                <div className="detail-stat"><span>{event.queue_type === 'unlimited' ? '♾️' : '⏰'}</span><span>{event.queue_type === 'unlimited' ? 'ไม่จำกัดจำนวน' : 'กำหนดรอบ'}</span></div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {!event.is_group && (
              <button className="btn btn-primary" onClick={() => navigate(`/organizer/events/${event.id}/control`)}>
                📢 เรียกคิว
              </button>
            )}
            <a href={`/display/${event.parent_id || event.id}`} target="_blank" className="btn btn-secondary">
              🖥️ จอแสดงผล
            </a>
            {!event.is_group && (
              <button className="btn btn-ghost" onClick={() => navigate(`/organizer/events/${event.id}/edit`)}>
                ✏️ แก้ไข
              </button>
            )}
            {event.parent_id && (
              <button className="btn btn-outline" onClick={() => navigate(`/organizer/events/${event.parent_id}`)}>
                🏠 ภาพรวมกิจกรรมหลัก
              </button>
            )}
            <select
              className="form-input form-select"
              value={event.status}
              style={{ width: 'auto', padding: '8px 32px 8px 12px' }}
              onChange={async e => {
                const status = e.target.value as Event['status']
                const { error } = await supabase.from('events').update({ status }).eq('id', event.id)
                if (!error) { setEvent(prev => prev ? { ...prev, status } : prev); toast.success('อัปเดตสถานะแล้ว') }
              }}
            >
              <option value="active">เปิด</option>
              <option value="paused">หยุด</option>
              <option value="closed">ปิด</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {(event.is_group ? [
          { key: 'activities', label: '📁 ภาพรวมงาน', count: childEvents.length },
          { key: 'qr', label: '📱 QR / ลิงก์', count: undefined },
        ] : [
          { key: 'bookings', label: '🎫 รายการจอง', count: activeBookings.length },
          { key: 'qr', label: '📱 QR / ลิงก์', count: undefined },
          { key: 'settings', label: '⚙️ ตั้งค่า', count: undefined },
          { key: 'line', label: '💚 LINE Bot', count: undefined },
        ] as { key: Tab; label: string; count: number | undefined }[]).map(tab => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key as Tab)}
          >
            {tab.label}
            {tab.count !== undefined && <span className="tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab: Activities (For Groups) */}
      {activeTab === 'activities' && event.is_group && (
        <div className="tab-content fade-in">
          {/* Group overview edit */}
          <div className="glass-card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3>📋 ข้อมูลงาน</h3>
              {!editingGroupInfo ? (
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  setEditGroupTitle(event.title)
                  setEditGroupDesc(event.description || '')
                  setEditGroupBannerPreview(event.banner_url || '')
                  setEditingGroupInfo(true)
                }}>✏️ แก้ไข</button>
              ) : (
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingGroupInfo(false)}>ยกเลิก</button>
                  <button className="btn btn-primary btn-sm" disabled={savingGroupInfo} onClick={async () => {
                    setSavingGroupInfo(true)
                    try {
                      let bannerUrl = event.banner_url
                      if (editGroupBannerFile) {
                        if (event.banner_url) {
                          try {
                            const urlObj = new URL(event.banner_url)
                            const pathParts = urlObj.pathname.split('/event-banners/')
                            if (pathParts.length > 1) {
                              const oldFilePath = pathParts[1]
                              await supabase.storage.from('event-banners').remove([oldFilePath])
                            }
                          } catch (e) {
                            console.error('Failed to delete old banner', e)
                          }
                        }
                        const ext = editGroupBannerFile.name.split('.').pop()
                        const filename = `${event.organizer_id}/${event.id}-banner.${ext}`
                        await supabase.storage.from('event-banners').upload(filename, editGroupBannerFile, { upsert: true })
                        const { data: { publicUrl } } = supabase.storage.from('event-banners').getPublicUrl(filename)
                        bannerUrl = publicUrl + '?v=' + Date.now()
                      }
                      const { error } = await supabase.from('events').update({
                        title: editGroupTitle.trim(),
                        description: editGroupDesc.trim() || null,
                        banner_url: bannerUrl,
                      }).eq('id', event.id)
                      if (error) throw error
                      setEvent(prev => prev ? { ...prev, title: editGroupTitle.trim(), description: editGroupDesc.trim() || null, banner_url: bannerUrl } : prev)
                      setEditingGroupInfo(false)
                      toast.success('อัปเดตข้อมูลงานแล้ว')
                    } catch {
                      toast.error('เกิดข้อผิดพลาด')
                    } finally {
                      setSavingGroupInfo(false)
                    }
                  }}>{savingGroupInfo ? 'กำลังบันทึก...' : '💾 บันทึก'}</button>
                </div>
              )}
            </div>
            {editingGroupInfo ? (
              <div className="settings-form">
                <div className="form-group">
                  <label className="form-label">ชื่องาน</label>
                  <input className="form-input" value={editGroupTitle} onChange={e => setEditGroupTitle(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">รายละเอียด</label>
                  <textarea className="form-input form-textarea" value={editGroupDesc} onChange={e => setEditGroupDesc(e.target.value)} rows={3} />
                </div>
                <div className="form-group">
                  <label className="form-label">แบนเนอร์</label>
                  {editGroupBannerPreview && (
                    <div style={{ marginBottom: '8px' }}>
                      <img src={editGroupBannerPreview} alt="banner" style={{ maxHeight: '120px', borderRadius: '8px' }} />
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setEditGroupBannerFile(file)
                      setEditGroupBannerPreview(URL.createObjectURL(file))
                    }
                  }} />
                </div>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '0' }}>
                  {event.description || 'ไม่มีรายละเอียด'}
                </p>
              </div>
            )}
          </div>

          {/* Sub-activities list */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3>กิจกรรมย่อยทั้งหมด ({childEvents.length})</h3>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/organizer/events/new?parent_id=${event.id}`)}>
              ➕ เพิ่มกิจกรรมย่อย
            </button>
          </div>
          {childEvents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">ยังไม่มีกิจกรรมย่อย</div>
              <div className="empty-state-desc">กดปุ่ม + เพิ่มกิจกรรมย่อย ด้านบนเพื่อเริ่มต้น</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {childEvents.map(child => (
                <div key={child.id} className="glass-card" style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    {child.banner_url ? (
                      <img src={child.banner_url} alt={child.title} style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px' }} />
                    ) : (
                      <div style={{ width: '64px', height: '64px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                        📋
                      </div>
                    )}
                    <div>
                      <h4 style={{ margin: '0 0 4px 0' }}>{child.title}</h4>
                      <span className="badge badge-active">คิว: {(child.settings as any)?.queue_prefix || ''}XXX</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/organizer/events/${child.id}`)}>
                      ⚙️ จัดการ
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate(`/organizer/events/${child.id}/control`)}>
                      📢 เรียกคิว
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Bookings */}
      {activeTab === 'bookings' && !event.is_group && (
        <div className="tab-content fade-in">
          <div className="bookings-toolbar">
            <input
              className="form-input"
              placeholder="🔍 ค้นหาชื่อ, หมายเลขคิว..."
              value={bookingSearch}
              onChange={e => setBookingSearch(e.target.value)}
              style={{ maxWidth: '300px' }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                className="btn btn-success btn-sm"
                onClick={() => exportToExcel({ event, bookings: bookings as BookingWithProfile[], customFields })}
              >
                📊 Excel
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => exportToGoogleSheets({ event, bookings: bookings as BookingWithProfile[], customFields })}
              >
                📋 Sheets
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleClearDatabase}>
                🗑️ ล้างข้อมูล
              </button>
            </div>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">ยังไม่มีการจอง</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>หมายเลขคิว</th>
                    {customFields.map(f => <th key={f.id}>{f.label}</th>)}
                    {event.queue_type === 'scheduled' && <th>รอบเวลา</th>}
                    <th>วันที่จอง</th>
                    <th>สถานะ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map(booking => {
                    const responses = (booking.field_responses || {}) as Record<string, string>
                    return (
                      <tr key={booking.id}>
                        <td>
                          <span className="queue-num-badge">#{booking.queue_number}</span>
                        </td>
                        {customFields.map(f => (
                          <td key={f.id}>{responses[f.id] || '-'}</td>
                        ))}
                        {event.queue_type === 'scheduled' && (
                          <td>
                            {booking.event_slots 
                              ? `${booking.event_slots.start_time.slice(0, 5)} - ${booking.event_slots.end_time.slice(0, 5)}`
                              : '-'}
                          </td>
                        )}
                        <td>{format(new Date(booking.created_at), 'dd/MM/yy HH:mm', { locale: th })}</td>
                        <td>
                          <span className={`badge badge-${booking.status}`}>
                            {STATUS_LABELS[booking.status]}
                          </span>
                        </td>
                        <td>
                          <select
                            className="form-input form-select"
                            value={booking.status}
                            style={{ padding: '3px 24px 3px 8px', fontSize: '0.8125rem', width: 'auto' }}
                            onChange={e => handleBookingStatusChange(booking.id, e.target.value as Booking['status'])}
                          >
                            <option value="waiting">รอเรียก</option>
                            <option value="called">เรียกแล้ว</option>
                            <option value="present">มาแล้ว</option>
                            <option value="absent">ไม่มา</option>
                            <option value="cancelled">ยกเลิก</option>
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: QR / Link */}
      {activeTab === 'qr' && (
        <div className="tab-content fade-in">
          <div className="qr-section">
            <div className="glass-card qr-card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
              <h3 style={{ marginBottom: 'var(--space-2)' }}>QR Code สำหรับจอง</h3>
              <p style={{ marginBottom: 'var(--space-6)', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                ผู้จองสแกน QR หรือกดลิงก์เพื่อจอง
              </p>
              <div className="qr-wrapper">
                <QRCodeCanvas
                  ref={qrRef}
                  value={bookingUrl}
                  size={200}
                  bgColor="#1a2235"
                  fgColor="#0ea5e9"
                  level="H"
                  includeMargin
                />
              </div>
              <div className="link-display">
                <input
                  className="form-input"
                  value={bookingUrl}
                  readOnly
                  style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 'var(--space-4)' }}>
                <button className="btn btn-primary" onClick={downloadQR}>⬇️ ดาวน์โหลด QR</button>
                <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(bookingUrl); toast.success('คัดลอกลิงก์แล้ว!') }}>
                  📋 คัดลอกลิงก์
                </button>
              </div>
            </div>
            <div className="qr-preview">
              {event.banner_url && <img src={event.banner_url} alt={event.title} className="qr-preview-banner" />}
              <h3>{event.title}</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>สแกน QR Code เพื่อจองคิว</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === 'settings' && (
        <div className="tab-content fade-in">
          <div className="glass-card" style={{ padding: 'var(--space-8)' }}>
            <h3 style={{ marginBottom: 'var(--space-6)' }}>ตั้งค่ากิจกรรม</h3>
            {queueSession && (
              <div className="settings-form">
                <div className="form-group">
                  <label className="form-label">เรียกคิวทีละกี่คน</label>
                  <input
                    type="number"
                    className="form-input"
                    min={1}
                    max={20}
                    value={queueSession.call_count_per_round}
                    style={{ maxWidth: '120px' }}
                    onChange={async e => {
                      const val = parseInt(e.target.value)
                      setQueueSession(prev => prev ? { ...prev, call_count_per_round: val } : prev)
                      await supabase.from('queue_sessions').update({ call_count_per_round: val }).eq('event_id', eventId)
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">แสดงชื่อบนหน้าจอใหญ่</label>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={queueSession.show_name}
                      onChange={async e => {
                        setQueueSession(prev => prev ? { ...prev, show_name: e.target.checked } : prev)
                        await supabase.from('queue_sessions').update({ show_name: e.target.checked }).eq('event_id', eventId)
                      }}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="form-group">
                  <label className="form-label">ภาษาเสียงเรียกคิว</label>
                  <select
                    className="form-input form-select"
                    value={queueSession.language}
                    style={{ maxWidth: '200px' }}
                    onChange={async e => {
                      const lang = e.target.value as 'th' | 'en'
                      setQueueSession(prev => prev ? { ...prev, language: lang } : prev)
                      await supabase.from('queue_sessions').update({ language: lang }).eq('event_id', eventId)
                    }}
                  >
                    <option value="th">🇹🇭 ภาษาไทย</option>
                    <option value="en">🇬🇧 English</option>
                  </select>
                </div>
              </div>
            )}
            
            <div className="settings-form" style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--color-border)' }}>
              <div className="form-group">
                <label className="form-label">อนุญาตให้ 1 เบอร์โทรศัพท์จองซ้ำได้ (ต่อ 1 กิจกรรม)</label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={(event.settings as any)?.allow_multiple_bookings !== false}
                    onChange={async e => {
                      const newSettings = { ...(event.settings as any || {}), allow_multiple_bookings: e.target.checked }
                      setEvent(prev => prev ? { ...prev, settings: newSettings } : prev)
                      await supabase.from('events').update({ settings: newSettings }).eq('id', eventId)
                      toast.success('อัปเดตการตั้งค่าสำเร็จ')
                    }}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: LINE */}
      {activeTab === 'line' && (
        <div className="tab-content fade-in">
          <div className="glass-card" style={{ padding: 'var(--space-8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
              <h3>💚 LINE Bot แจ้งเตือน</h3>
              <label className="toggle">
                <input type="checkbox" checked={lineActive} onChange={e => setLineActive(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="settings-form">
              <div className="form-group">
                <label className="form-label">LINE Channel Access Token</label>
                <input className="form-input" type="password" placeholder="เพิ่ม token จาก LINE Developer Console" value={lineToken} onChange={e => setLineToken(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">LINE Group ID</label>
                <input className="form-input" placeholder="Group ID ที่ต้องการส่งแจ้งเตือน" value={lineGroupId} onChange={e => setLineGroupId(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">แจ้งเตือนก่อนเรียกคิว (นาที)</label>
                <input type="number" className="form-input" min={1} value={lineBeforeMinutes} onChange={e => setLineBeforeMinutes(parseInt(e.target.value))} style={{ maxWidth: '120px' }} />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <label className="checkbox-wrapper">
                  <input type="checkbox" checked={lineNotifyCall} onChange={e => setLineNotifyCall(e.target.checked)} />
                  <span>เรียกคิวถัดไป</span>
                </label>
                <label className="checkbox-wrapper">
                  <input type="checkbox" checked={lineNotifyAvailable} onChange={e => setLineNotifyAvailable(e.target.checked)} />
                  <span>ประกาศคิวว่าง</span>
                </label>
                <label className="checkbox-wrapper">
                  <input type="checkbox" checked={lineNotifyClose} onChange={e => setLineNotifyClose(e.target.checked)} />
                  <span>ปิดกิจกรรม</span>
                </label>
              </div>
              <button className="btn btn-primary" onClick={handleSaveLineSettings}>
                💾 บันทึกการตั้งค่า LINE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
