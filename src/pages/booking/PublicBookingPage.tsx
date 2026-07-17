import { useEffect, useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useSystemStore } from '../../stores/systemStore'
import type { Event, EventSlot, CustomField, Booking } from '../../lib/database.types'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import toast from 'react-hot-toast'
import './PublicBookingPage.css'

export default function PublicBookingPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { user, initialized } = useAuthStore()
  const { systemName } = useSystemStore()

  const [event, setEvent] = useState<Event | null>(null)
  const [slots, setSlots] = useState<EventSlot[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [myBooking, setMyBooking] = useState<Booking | null>(null)

  const [selectedSlot, setSelectedSlot] = useState<EventSlot | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [childEvents, setChildEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelPhone, setCancelPhone] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelBookingsList, setCancelBookingsList] = useState<any[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [cancelStep, setCancelStep] = useState<'search' | 'confirm' | 'list'>('search')
  const [cancelConfirmName, setCancelConfirmName] = useState('')

  const [step, setStep] = useState<'view' | 'form' | 'done'>('view')

  const [ticketDownloaded, setTicketDownloaded] = useState(false)
  const [ticketImageUrl, setTicketImageUrl] = useState<string | null>(null)
  const ticketRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (step === 'done' && myBooking && !ticketDownloaded) {
      const timer = setTimeout(() => {
        handleDownloadTicket()
        setTicketDownloaded(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [step, myBooking, ticketDownloaded])

  const handleCloseWindow = () => {
    if (eventId) {
      localStorage.removeItem('booking_' + eventId)
    }
    // Try standard close
    window.close()
    
    // Check if the window is still open and perform fallback actions
    setTimeout(() => {
      // Direct browsers to a blank page
      try {
        window.location.href = "about:blank"
      } catch (e) {
        // As a last resort, alert user to close manually
        alert("กรุณาปิดแท็บนี้ด้วยตนเอง")
      }
    }, 200)
  }

  const handleDownloadTicket = async () => {
    if (!ticketRef.current || !event) return
    try {
      const canvas = await html2canvas(ticketRef.current, { backgroundColor: '#111827', scale: 2 })
      const url = canvas.toDataURL('image/png')
      setTicketImageUrl(url)
      const a = document.createElement('a')
      a.href = url
      const sanitizedTitle = event.title.replace(/[^a-zA-Z0-9ก-๙]/g, '_')
      a.download = `Ticket-${sanitizedTitle}-Q${myBooking?.queue_number}-${Date.now().toString().slice(-6)}.png`
      a.click()
      toast.success('ดาวน์โหลดตั๋วคิวเรียบร้อย')
    } catch (err) {
      console.error(err)
      toast.error('ไม่สามารถดาวน์โหลดตั๋วได้')
    }
  }

  useEffect(() => {
    fetchEventData()
  }, [eventId, user])

  const fetchEventData = async () => {
    if (!eventId) return
    setLoading(true)
    setStep('view')
    setMyBooking(null)
    setTicketDownloaded(false)
    setTicketImageUrl(null)
    try {
      const [eventRes, slotsRes, fieldsRes, childrenRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('event_slots').select('*').eq('event_id', eventId).order('slot_date').order('start_time'),
        supabase.from('custom_fields').select('*').eq('event_id', eventId).order('sort_order'),
        supabase.from('events').select('*').eq('parent_id', eventId).order('created_at', { ascending: true }),
      ])

      if (eventRes.data) setEvent(eventRes.data)
      if (childrenRes.data) setChildEvents(childrenRes.data)
      if (slotsRes.data) setSlots(slotsRes.data)
      if (fieldsRes.data) {
        setCustomFields(fieldsRes.data)
        const init: Record<string, string> = {}
        fieldsRes.data.forEach(f => { init[f.id] = '' })
        setFieldValues(init)
      }

      // Removed logged-in user booking check since it's anonymous
      // If we want to persist across reload we could check localStorage, 
      // but the requirement is to use phone number search to find booking.
      const localBookingId = localStorage.getItem('booking_' + eventId)
      if (localBookingId) {
        const { data } = await supabase.from('bookings').select('*').eq('id', localBookingId).maybeSingle()
        if (data && data.status !== 'cancelled') {
          setMyBooking(data)
          setStep('done')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBook = async () => {
    if (!event) return

    // Validate fields
    for (const field of customFields) {
      const val = fieldValues[field.id] || ''
      if (field.is_required && !val.trim()) {
        toast.error(`กรุณากรอก ${field.label}`)
        return
      }

      // Phone number validation
      if (field.field_type === 'phone' && val) {
        if (!/^0[689]\d{8}$/.test(val)) {
          toast.error(`กรุณากรอกเบอร์มือถือให้ถูกต้อง (เช่น 0891234567, ห้ามมีขีดกลาง)`)
          return
        }
      }
    }

    if ((event.settings as any)?.allow_multiple_bookings === false) {
      const phoneField = customFields.find(f => f.field_type === 'phone')
      if (phoneField && fieldValues[phoneField.id]) {
        const phoneValue = fieldValues[phoneField.id]
        const { data: existingBookings } = await supabase.rpc('get_my_booking_by_phone', {
          p_event_id: event.id,
          p_phone: phoneValue
        })
        if (existingBookings && existingBookings.length > 0) {
          toast.error('เบอร์โทรศัพท์นี้มีการจองที่รอคิวอยู่แล้ว ไม่สามารถจองซ้ำได้')
          return
        }
      }
    }

    if (selectedSlot && event.parent_id) {
      const phoneField = customFields.find(f => f.field_type === 'phone')
      if (phoneField && fieldValues[phoneField.id]) {
        const phoneValue = fieldValues[phoneField.id]

        const { data: siblings } = await supabase.from('events').select('id').eq('parent_id', event.parent_id)
        if (siblings) {
          const promises = siblings.map(s => supabase.rpc('get_my_booking_by_phone', { p_event_id: s.id, p_phone: phoneValue }))
          const results = await Promise.all(promises)
          const allUserBookings = results.flatMap(r => r.data || [])

          const bookedSlotIds = allUserBookings.map(b => b.slot_id).filter(id => id)
          if (bookedSlotIds.length > 0) {
            const { data: bookedSlots } = await supabase.from('event_slots').select('*').in('id', bookedSlotIds)
            if (bookedSlots) {
              const isOverlap = bookedSlots.some(bs => {
                if (bs.slot_date !== selectedSlot.slot_date) return false
                return (selectedSlot.start_time < bs.end_time) && (selectedSlot.end_time > bs.start_time)
              })

              if (isOverlap) {
                toast.error('ช่วงเวลานี้ตรงกับกิจกรรมอื่นที่คุณได้จองไว้แล้ว กรุณาเลือกรอบเวลาอื่น')
                return
              }
            }
          }
        }
      }
    }

    setBooking(true)
    try {
      const { error } = await supabase
        .from('bookings')
        .insert({
          event_id: event.id,
          slot_id: selectedSlot?.id || null,
          user_id: user?.id || null, // Allow anonymous
          queue_number: 0, // auto-assigned by trigger
          status: 'waiting',
          field_responses: fieldValues,
        })

      if (error) throw error

      // After successful insert, fetch the booking details using the phone number
      const phoneField = customFields.find(f => f.field_type === 'phone')
      const phoneValue = phoneField ? fieldValues[phoneField.id] : null

      if (phoneValue) {
        const { data: bData } = await supabase.rpc('get_my_booking_by_phone', {
          p_event_id: event.id,
          p_phone: phoneValue
        })

        if (bData && bData.length > 0) {
          setMyBooking(bData[0])
          localStorage.setItem('booking_' + eventId, bData[0].id)
        }
      }

      setTicketDownloaded(false)
      setTicketImageUrl(null)
      setStep('done')
      toast.success('จองคิวสำเร็จ! 🎉')
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('duplicate') || msg.includes('already')) {
        toast.error('คุณได้จองไว้แล้ว')
      } else {
        toast.error('เกิดข้อผิดพลาดในการจอง')
      }
    } finally {
      setBooking(false)
    }
  }


  const handleSearchAndCancel = async () => {
    if (!cancelPhone.trim()) return
    if (!/^0[689]\d{8}$/.test(cancelPhone)) {
      toast.error('กรุณากรอกเบอร์มือถือให้ถูกต้อง')
      return
    }

    setCancelLoading(true)
    setHasSearched(false)
    setCancelBookingsList([])

    let allBookings: any[] = []

    if (event?.is_group) {
      const promises = childEvents.map(child =>
        supabase.rpc('get_my_booking_by_phone', { p_event_id: child.id, p_phone: cancelPhone })
          .then(res => res.data ? res.data.map((b: any) => ({ ...b, event_title: child.title, _event_id: child.id })) : [])
      )
      const results = await Promise.all(promises)
      allBookings = results.flat()
    } else {
      const { data, error } = await supabase.rpc('get_my_booking_by_phone', {
        p_event_id: eventId,
        p_phone: cancelPhone
      })
      if (!error && data) {
        allBookings = data.map((b: any) => ({ ...b, event_title: event?.title || '', _event_id: eventId }))
      }
    }

    setCancelLoading(false)
    setHasSearched(true)

    if (allBookings.length > 0) {
      const firstB = allBookings[0]
      const responses = firstB.field_responses || {}

      let fieldsToSearch = customFields
      if (firstB._event_id !== event?.id) {
        const { data } = await supabase.from('custom_fields').select('*').eq('event_id', firstB._event_id)
        if (data) fieldsToSearch = data
      }

      let foundName = ''
      const nameField = fieldsToSearch.find(f => f.label.includes('ชื่อ') || f.label.toLowerCase().includes('name'))
      if (nameField && responses[nameField.id]) {
        foundName = responses[nameField.id]
      } else {
        const textField = fieldsToSearch.find(f => f.field_type === 'text')
        if (textField && responses[textField.id]) {
          foundName = responses[textField.id]
        }
      }

      if (!foundName) {
        const possibleNames = Object.values(responses).filter(v => typeof v === 'string' && !/^0[689]\d{8}$/.test(v))
        foundName = (possibleNames[0] as string) || (Object.values(responses)[0] as string) || 'ลูกค้า'
      }

      setCancelConfirmName(foundName)
      setCancelBookingsList(allBookings)
      setCancelStep('confirm')
    } else {
      setCancelBookingsList([])
      setCancelStep('list')
    }
  }

  const handleCancelSpecificBooking = async (bEventId: string, bPhone: string) => {
    if (!confirm('ต้องการยกเลิกการจองนี้ใช่ไหม?')) return

    const { data: cancelSuccess } = await supabase.rpc('cancel_booking_by_phone', {
      p_event_id: bEventId,
      p_phone: bPhone
    })

    if (cancelSuccess) {
      toast.success('ยกเลิกการจองเรียบร้อยแล้ว')
      // Refetch
      handleSearchAndCancel()
      // If the cancelled booking was the current myBooking, clear it
      if (myBooking && bEventId === eventId) {
        setMyBooking(null)
        setStep('view')
        localStorage.removeItem('booking_' + eventId)
        fetchEventData()
      }
    } else {
      toast.error('ไม่สามารถยกเลิกการจองได้')
    }
  }

  const handleCancelBooking = async () => {
    if (!myBooking || !confirm('ต้องการยกเลิกการจองนี้ใช่ไหม?')) return
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', myBooking.id)
    if (error) { toast.error('เกิดข้อผิดพลาด'); return }
    setMyBooking(null)
    setStep('view')
    toast.success('ยกเลิกการจองแล้ว')
    fetchEventData()
  }

  if (!initialized || loading) {
    return (
      <div className="booking-page">
        <div className="loading-overlay"><div className="spinner spinner-lg" /></div>
      </div>
    )
  }

  if (!event) {
    return <div className="booking-page"><div className="empty-state"><div className="empty-state-title">ไม่พบกิจกรรมนี้</div></div></div>
  }

  const isEventOpen = event.status === 'active'

  return (
    <div className="booking-page fade-in">
      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="modal-overlay fade-in" onClick={() => setShowCancelModal(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ padding: 'var(--space-6)', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 'var(--space-2)' }}>🔍 ค้นหาการจองของคุณ</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', fontSize: '0.875rem' }}>
              กรอกเบอร์โทรศัพท์มือถือที่ใช้ในการจองเพื่อดูข้อมูลหรือยกเลิกคิว
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                type="tel"
                className="form-input"
                placeholder="เช่น 0891234567"
                value={cancelPhone}
                onChange={e => {
                  setCancelPhone(e.target.value)
                  if (cancelStep !== 'search') {
                    setCancelStep('search')
                    setHasSearched(false)
                  }
                }}
                maxLength={10}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={handleSearchAndCancel} disabled={cancelLoading || cancelPhone.length < 10}>
                {cancelLoading ? 'ค้นหา...' : 'ค้นหา'}
              </button>
            </div>

            {cancelStep === 'confirm' && (
              <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
                <h3 style={{ marginBottom: 'var(--space-4)', color: 'var(--color-primary)' }}>ยืนยันตัวตน</h3>
                <p style={{ fontSize: '1.1rem', marginBottom: 'var(--space-6)' }}>คุณคือ <strong>คุณ {cancelConfirmName}</strong> ใช่หรือไม่?</p>
                <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
                  <button className="btn btn-ghost" onClick={() => { setCancelStep('search'); setHasSearched(false); setCancelPhone('') }}>ไม่ใช่เบอร์ฉัน</button>
                  <button className="btn btn-primary" onClick={() => setCancelStep('list')}>ใช่, ดำเนินการต่อ</button>
                </div>
              </div>
            )}

            {cancelStep === 'list' && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                {cancelBookingsList.length === 0 ? (
                  <p style={{ color: 'var(--color-danger)', textAlign: 'center', margin: 'var(--space-4) 0' }}>ไม่พบการจองที่รอคิวสำหรับเบอร์โทรนี้</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <h4 style={{ margin: 'var(--space-2) 0' }}>รายการจองของคุณ:</h4>
                    {cancelBookingsList.map(b => {
                      const bEvent = event?.is_group ? childEvents.find(c => c.id === b._event_id) : event
                      const prefix = (bEvent?.settings as any)?.queue_prefix || ''
                      const formattedQueue = `${prefix}${String(b.queue_number).padStart(3, '0')}`
                      return (
                        <div key={b.id} style={{ padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{b.event_title}</div>
                            <div style={{ color: 'var(--color-primary)', fontSize: '0.9rem' }}>คิวหมายเลข {formattedQueue}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>สถานะ: รอเรียก</div>
                          </div>
                          <button className="btn btn-danger btn-sm" onClick={() => handleCancelSpecificBooking(b._event_id, cancelPhone)}>
                            ยกเลิก
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-6)' }}>
              <button className="btn btn-ghost" onClick={() => setShowCancelModal(false)}>ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}

      {/* Event Banner & Info */}
      <div className="booking-event-card glass-card">
        {event.banner_url && (
          <div className="booking-banner">
            <img src={`${event.banner_url}${event.banner_url.includes('?') ? '&' : '?'}t=${new Date(event.updated_at).getTime()}`} alt={event.title} />
          </div>
        )}
        <div className="booking-event-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <h1 className="booking-event-title" style={{ wordBreak: 'break-word' }}>{event.title}</h1>
            {isEventOpen ? (
              <span className="badge badge-active">● เปิดรับจอง</span>
            ) : (
              <span className="badge badge-closed">✕ ปิดแล้ว</span>
            )}
          </div>
          {event.description && <p className="booking-event-desc">{event.description}</p>}
          <div className="booking-event-meta">
            {event.is_group ? (
              <span>📁 กรุณาเลือกกิจกรรมที่ต้องการจอง</span>
            ) : (
              <span>{event.queue_type === 'unlimited' ? '♾️ ไม่จำกัดจำนวน' : `⏰ กำหนดรอบเวลา (${slots.length} รอบ)`}</span>
            )}
          </div>
          {/* ปุ่มยกเลิกการจอง — แสดงเสมอ ไม่ต้อง login (เฉพาะงานหลักหรือกลุ่ม) */}
          {step !== 'done' && (event.is_group || !event.parent_id) && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 'var(--space-3)', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}
              onClick={() => {
                setShowCancelModal(true)
                setHasSearched(false)
                setCancelStep('search')
                setCancelBookingsList([])
              }}
            >
              🔍 ค้นหา / ยกเลิกการจอง
            </button>
          )}
        </div>
      </div>



      {/* Event Group Activity Selector */}
      {step === 'view' && event.is_group && (
        <div className="child-events-grid" style={{ marginTop: 'var(--space-6)', display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {childEvents.length === 0 && <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--color-text-muted)' }}>ยังไม่มีกิจกรรมย่อยที่เปิดรับจอง</p>}
          {childEvents.filter(c => c.status === 'active').map(child => (
            <div key={child.id} className="glass-card clickable" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid rgba(14, 165, 233, 0.2)' }} onClick={() => navigate(`/book/${child.id}`)}>
              {child.banner_url ? (
                <img src={child.banner_url} alt={child.title} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
              ) : (
                <div style={{ width: '80px', height: '80px', background: 'rgba(14, 165, 233, 0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                  📋
                </div>
              )}
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>{child.title}</h4>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  {child.queue_type === 'unlimited' ? '♾️ ไม่จำกัดคิว' : '⏰ จองเป็นรอบ'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Done state - My booking */}
      {step === 'done' && myBooking && (
        <div className="booking-success-card glass-card fade-in">
          <div className="booking-success-icon">🎫</div>
          <div className="booking-success-title">จองคิวสำเร็จ!</div>

          {ticketImageUrl ? (
            <img src={ticketImageUrl} alt="Ticket" style={{ width: '100%', maxWidth: '320px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', marginBottom: '16px' }} />
          ) : (
            <div className="booking-ticket" ref={ticketRef} style={{ padding: '24px', borderRadius: '12px' }}>
              <div className="booking-ticket-label">หมายเลขคิวของคุณ</div>
              <div className="booking-ticket-number">
                {(event.settings as any)?.queue_prefix || ''}{String(myBooking.queue_number).padStart(3, '0')}
              </div>
              <div className="booking-ticket-event">{event.title}</div>
              {myBooking.slot_id && slots.find(s => s.id === myBooking.slot_id) && (
                <div className="booking-ticket-slot" style={{ fontWeight: 600, color: 'var(--color-primary)', margin: '8px 0', fontSize: '1.1rem' }}>
                  รอบ: {slots.find(s => s.id === myBooking.slot_id)?.start_time.slice(0, 5)} - {slots.find(s => s.id === myBooking.slot_id)?.end_time.slice(0, 5)} น.
                </div>
              )}
              <div className="booking-ticket-date">
                จองเมื่อ {format(new Date(myBooking.created_at), 'dd MMMM yyyy HH:mm น.', { locale: th })}
              </div>
            </div>
          )}

          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center' }}>
            กรุณารอฟังเรียกหมายเลขคิวของคุณ <br /> (หากไม่ได้ภาพตั๋ว สามารถกดค้างที่รูปภาพเพื่อบันทึกได้)
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-danger btn-sm" onClick={handleCloseWindow}>
              ✕ ปิดหน้าต่าง
            </button>
            {event.parent_id && (
              <button className="btn btn-ghost btn-sm" onClick={() => {
                if (eventId) {
                  localStorage.removeItem('booking_' + eventId)
                }
                window.location.href = `/book/${event.parent_id}`
              }} style={{ border: '1px solid var(--color-border)' }}>
                ✕ เลือกกิจกรรมอื่น
              </button>
            )}
          </div>
        </div>
      )}

      {/* Booking Form */}
      {step === 'view' && isEventOpen && !event.is_group && (
        <>
          {/* Scheduled: Slot picker */}
          {event.queue_type === 'scheduled' && slots.length > 0 && (
            <div className="booking-section glass-card">
              <h2>เลือกรอบเวลา</h2>
              <div className="slot-grid">
                {slots.map(slot => {
                  const isFull = slot.status === 'full' || slot.booked_count >= slot.capacity
                  const isClosed = slot.status === 'closed'
                  const available = slot.capacity - slot.booked_count
                  return (
                    <div
                      key={slot.id}
                      className={`slot-card ${isFull ? 'slot-card-full' : ''} ${isClosed ? 'slot-card-closed' : ''} ${selectedSlot?.id === slot.id ? 'selected' : ''}`}
                      onClick={() => { if (!isFull && !isClosed) setSelectedSlot(slot) }}
                    >
                      <div className="slot-time">{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</div>
                      <div className="slot-capacity">{format(new Date(slot.slot_date), 'dd MMM', { locale: th })}</div>
                      {isFull ? (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-danger-light)', fontWeight: 600 }}>เต็มแล้ว</div>
                      ) : isClosed ? (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>ปิด</div>
                      ) : (
                        <div className="slot-available">ว่าง {available}/{slot.capacity} ที่</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Form */}
          {(event.queue_type === 'unlimited' || selectedSlot) && (
            <div className="booking-section glass-card fade-in">
              <h2>กรอกข้อมูลการจอง</h2>
              {customFields.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)' }}>ไม่มีข้อมูลที่ต้องกรอก</p>
              ) : (
                <div className="booking-form">
                  {customFields.map(field => (
                    <div key={field.id} className="form-group">
                      <label className="form-label">
                        {field.label}
                        {field.is_required && <span className="required"> *</span>}
                      </label>
                      {field.field_type === 'select' ? (
                        <select
                          className="form-input form-select"
                          value={fieldValues[field.id] || ''}
                          onChange={e => setFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                        >
                          <option value="">-- เลือก --</option>
                          {((field.options as string[]) || []).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.field_type === 'phone' ? 'tel' : field.field_type}
                          className="form-input"
                          placeholder={`กรอก${field.label}`}
                          value={fieldValues[field.id] || ''}
                          onChange={e => setFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                          required={field.is_required}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: 'var(--space-4)' }}
                onClick={handleBook}
                disabled={booking}
              >
                {booking ? (
                  <><div className="spinner" /> กำลังจอง...</>
                ) : (
                  <>🎫 ยืนยันจองคิว</>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {!isEventOpen && step !== 'done' && (
        <div className="empty-state glass-card" style={{ padding: 'var(--space-10)' }}>
          <div className="empty-state-icon">🔒</div>
          <div className="empty-state-title">กิจกรรมนี้ปิดรับจองแล้ว</div>
          <div className="empty-state-desc">ขอบคุณที่ใช้บริการ {systemName}</div>
        </div>
      )}
    </div>
  )
}
