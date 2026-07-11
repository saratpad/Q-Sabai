import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import type { Event } from '../../lib/database.types'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import toast from 'react-hot-toast'
import './OrganizerDashboard.css'

const SERVICE_ICONS: Record<string, string> = {
  'ตัดผม': '✂️',
  'ทำเล็บ': '💅',
  'ตรวจสุขภาพ': '🏥',
  'นวดไทย': '💆',
  default: '📋',
}

function getEventIcon(title: string): string {
  for (const [key, icon] of Object.entries(SERVICE_ICONS)) {
    if (title.includes(key)) return icon
  }
  return SERVICE_ICONS.default
}

export default function OrganizerDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, active: 0, totalBookings: 0 })

  useEffect(() => {
    fetchEvents()
  }, [user])

  const fetchEvents = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('organizer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      const allEvents = data || []
      const parentEvents = allEvents.filter(e => e.parent_id === null)
      const childEvents = allEvents.filter(e => e.parent_id !== null)
      
      const eventsWithChildren = parentEvents.map(p => ({
        ...p,
        children: childEvents.filter(c => c.parent_id === p.id)
      }))

      setEvents(eventsWithChildren as any)

      // Fetch booking counts
      const { count } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .in('event_id', (data || []).map(e => e.id))
        .neq('status', 'cancelled')

      setStats({
        total: data?.length || 0,
        active: data?.filter(e => e.status === 'active').length || 0,
        totalBookings: count || 0,
      })
    } catch (err) {
      toast.error('ไม่สามารถโหลดข้อมูลได้')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (eventId: string, status: Event['status']) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ status })
        .eq('id', eventId)
      if (error) throw error
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status } : e))
      toast.success(status === 'active' ? 'เปิดกิจกรรมแล้ว' : status === 'paused' ? 'หยุดกิจกรรมชั่วคราว' : 'ปิดกิจกรรมแล้ว')
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    }
  }

  const handleDelete = async (eventId: string) => {
    if (!confirm('ต้องการลบกิจกรรมนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้')) return
    try {
      const { error } = await supabase.from('events').delete().eq('id', eventId)
      if (error) throw error
      setEvents(prev => prev.filter(e => e.id !== eventId))
      toast.success('ลบกิจกรรมแล้ว')
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    }
  }

  const statusLabel = (status: Event['status']) => {
    if (status === 'active') return <span className="badge badge-active">● เปิดรับจอง</span>
    if (status === 'paused') return <span className="badge badge-paused">⏸ หยุดชั่วคราว</span>
    return <span className="badge badge-closed">✕ ปิดแล้ว</span>
  }

  return (
    <div className="dashboard fade-in">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>สวัสดี, {user?.display_name} 👋</h1>
          <p>จัดการกิจกรรมและคิวสวัสดิการขององค์กร</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/organizer/events/new')}>
            ➕ สร้างกิจกรรม
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">กิจกรรมทั้งหมด</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🟢</div>
          <div>
            <div className="stat-value">{stats.active}</div>
            <div className="stat-label">กิจกรรมที่เปิดอยู่</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎫</div>
          <div>
            <div className="stat-value">{stats.totalBookings}</div>
            <div className="stat-label">การจองทั้งหมด</div>
          </div>
        </div>
      </div>

      {/* Events */}
      <div className="dashboard-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>กิจกรรมของฉัน</h2>
        </div>
        {loading ? (
          <div className="loading-overlay">
            <div className="spinner spinner-lg" />
            <span>กำลังโหลด...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">ยังไม่มีกิจกรรม</div>
            <div className="empty-state-desc">กดปุ่ม "สร้างกิจกรรมใหม่" ด้านบนเพื่อเริ่มต้น</div>
          </div>
        ) : (
          <div className="event-grid">
            {events.map(event => (
              <div key={event.id} className="event-card" onClick={() => navigate(`/organizer/events/${event.id}`)}>
                <div className="event-card-banner">
                  {event.banner_url ? (
                    <img src={event.banner_url} alt={event.title} />
                  ) : (
                    <div className="event-card-banner-placeholder">
                      {getEventIcon(event.title)}
                    </div>
                  )}
                  <div className="event-card-status">{statusLabel(event.status)}</div>
                </div>
                <div className="event-card-body">
                  <div className="event-card-title">{event.title}</div>
                  <div className="event-card-meta">
                    {event.is_group ? (
                      <span>📁 แฟ้มรวมกิจกรรม</span>
                    ) : (
                      <span>{event.queue_type === 'unlimited' ? '♾️ ไม่จำกัดคิว' : '⏰ กำหนดรอบ'}</span>
                    )}
                    <span>📅 {format(new Date(event.created_at), 'dd MMM yy', { locale: th })}</span>
                  </div>
                  {event.description && (
                    <p className="event-card-desc" style={{ marginBottom: '8px' }}>{event.description}</p>
                  )}
                  {event.is_group && (event as any).children?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: 'var(--space-3)' }}>
                      {(event as any).children.map((c: any) => (
                        <span key={c.id} style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                          {c.title}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="event-card-actions" onClick={e => e.stopPropagation()}>
                    {!event.is_group && (
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => navigate(`/organizer/events/${event.id}/control`)}
                      >
                        📢 เรียกคิว
                      </button>
                    )}
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => navigate(`/organizer/events/${event.id}`)}
                    >
                      ✏️ จัดการ
                    </button>
                    <select
                      className="form-input form-select"
                      style={{ padding: '4px 28px 4px 8px', fontSize: '0.8125rem', width: 'auto' }}
                      value={event.status}
                      onChange={e => handleStatusChange(event.id, e.target.value as Event['status'])}
                    >
                      <option value="active">เปิด</option>
                      <option value="paused">หยุด</option>
                      <option value="closed">ปิด</option>
                    </select>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(event.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
