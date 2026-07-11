import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import type { Booking, Event } from '../../lib/database.types'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import toast from 'react-hot-toast'

interface BookingWithEvent extends Booking {
  events: Event
}

const STATUS_LABELS: Record<Booking['status'], string> = {
  waiting: '⏳ รอเรียก',
  called: '📢 เรียกแล้ว!',
  present: '✅ มาแล้ว',
  absent: '❌ ไม่มา',
  cancelled: '🚫 ยกเลิก',
}

export default function MyBookingsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [bookings, setBookings] = useState<BookingWithEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBookings()
  }, [user])

  const fetchBookings = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, events(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setBookings((data || []) as BookingWithEvent[])
    setLoading(false)
  }

  const handleCancel = async (bookingId: string) => {
    if (!confirm('ต้องการยกเลิกการจองนี้?')) return
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId)
    if (error) { toast.error('เกิดข้อผิดพลาด'); return }
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'cancelled' as Booking['status'] } : b))
    toast.success('ยกเลิกการจองแล้ว')
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: 'var(--space-6)' }}>🎫 การจองของฉัน</h1>
      {loading ? (
        <div className="loading-overlay"><div className="spinner spinner-lg" /></div>
      ) : bookings.length === 0 ? (
        <div className="empty-state glass-card" style={{ padding: 'var(--space-10)' }}>
          <div className="empty-state-icon">🎟️</div>
          <div className="empty-state-title">ยังไม่มีการจอง</div>
          <div className="empty-state-desc">เข้าลิงก์กิจกรรมเพื่อจองคิวใช้บริการ</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {bookings.map(booking => (
            <div key={booking.id} className="glass-card" style={{ padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
                    {booking.events?.title}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    จอง {format(new Date(booking.created_at), 'dd MMM yyyy HH:mm', { locale: th })}
                  </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                  <span
                    className={`badge badge-${booking.status}`}
                    style={{ fontSize: '0.875rem', padding: '4px 12px' }}
                  >
                    {STATUS_LABELS[booking.status]}
                  </span>
                  {booking.status === 'waiting' && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleCancel(booking.id)}
                    >
                      ยกเลิก
                    </button>
                  )}
                </div>
              </div>
              <div style={{
                marginTop: 'var(--space-4)',
                paddingTop: 'var(--space-4)',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>หมายเลขคิว</div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '2rem',
                    fontWeight: 800,
                    background: 'var(--gradient-primary)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    lineHeight: 1,
                  }}>
                    #{(booking.events.settings as any)?.queue_prefix || ''}{String(booking.queue_number).padStart(3, '0')}
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigate(`/book/${booking.event_id}`)}
                >
                  ดูรายละเอียด
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
