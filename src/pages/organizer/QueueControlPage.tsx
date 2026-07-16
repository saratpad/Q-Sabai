import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Event, Booking, QueueSession, CustomField, EventSlot } from '../../lib/database.types'
import toast from 'react-hot-toast'
import './QueueControlPage.css'

interface BookingDisplay extends Booking {
  field_responses: Record<string, string>
}

export default function QueueControlPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()

  const [event, setEvent] = useState<Event | null>(null)
  const [session, setSession] = useState<QueueSession | null>(null)
  const [bookings, setBookings] = useState<BookingDisplay[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [slots, setSlots] = useState<EventSlot[]>([])
  const [calling, setCalling] = useState(false)
  const [unlockedSlotId, setUnlockedSlotId] = useState<string | null>(null)

  const fetchBookings = async () => {
    if (!eventId) return
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('event_id', eventId)
      .neq('status', 'cancelled')
      .order('queue_number')
    if (data) setBookings(data as BookingDisplay[])
  }

  useEffect(() => {
    fetchData()

    if (!eventId) return

    const channel = supabase
      .channel(`queue-control-bookings-${eventId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        console.log('Realtime bookings change received (QueueControl):', payload)
        fetchBookings()
      })
      .subscribe((status) => {
        console.log(`Realtime bookings subscription status (QueueControl): ${status}`)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId])

  const fetchData = async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const [eventRes, sessionRes, fieldsRes, slotsRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('queue_sessions').select('*').eq('event_id', eventId).single(),
        supabase.from('custom_fields').select('*').eq('event_id', eventId).order('sort_order'),
        supabase.from('event_slots').select('*').eq('event_id', eventId).order('start_time'),
      ])

      if (eventRes.data) setEvent(eventRes.data)
      if (sessionRes.data) setSession(sessionRes.data)
      await fetchBookings()
      if (fieldsRes.data) setCustomFields(fieldsRes.data)
      if (slotsRes.data) setSlots(slotsRes.data)
    } finally {
      setLoading(false)
    }
  }

  const getNextBookings = (count: number): BookingDisplay[] => {
    const currentNums = session?.current_numbers || []
    const maxCalled = currentNums.length > 0 ? Math.max(...currentNums) : 0

    const candidates = bookings
      .filter(b => b.status === 'waiting')
      .sort((a, b) => a.queue_number - b.queue_number)

    if (candidates.length === 0) return []

    if (event?.queue_type === 'scheduled') {
      const candidatesInUnlockedSlot = candidates.filter(b => b.slot_id === unlockedSlotId);
      if (candidatesInUnlockedSlot.length === 0) return []
      return candidatesInUnlockedSlot.slice(0, count)
    }

    return candidates.slice(0, count)
  }

  const getNameForBooking = (booking: BookingDisplay) => {
    const responses = booking.field_responses || {}
    const firstField = customFields.find(f => f.field_type === 'text')
    if (firstField && responses[firstField.id]) return responses[firstField.id]
    return Object.values(responses)[0] || ''
  }

  const handleCallNext = async () => {
    if (!session || !eventId) return
    setCalling(true)
    try {
      const count = session.call_count_per_round
      const nextBookings = getNextBookings(count)

      if (nextBookings.length === 0) {
        toast('ไม่มีคิวที่รอเรียกแล้ว', { icon: 'ℹ️' })
        return
      }

      const newNumbers = nextBookings.map(b => b.queue_number)

      // Update queue session
      const { error } = await supabase
        .from('queue_sessions')
        .update({ current_numbers: newNumbers, updated_at: new Date().toISOString() })
        .eq('event_id', eventId)

      if (error) throw error

      // Mark bookings as called
      await supabase
        .from('bookings')
        .update({ status: 'called', called_at: new Date().toISOString() })
        .in('id', nextBookings.map(b => b.id))

      setSession(prev => prev ? { ...prev, current_numbers: newNumbers } : prev)
      const nextIds = nextBookings.map(b => b.id)
      setBookings(prev => prev.map(b =>
        nextIds.includes(b.id) ? { ...b, status: 'called' as Booking['status'], called_at: new Date().toISOString() } : b
      ))

      // TTS Broadcast
      const names = nextBookings.map(b => getNameForBooking(b))
      supabase.channel(`queue:${eventId}`).send({
        type: 'broadcast',
        event: 'TTS_PLAY',
        payload: {
          language: session.language,
          queueNumbers: newNumbers,
          names,
          showName: ttsCallName,
          phrase: ttsPhrase,
          voiceGender: ttsVoiceGender,
          useEndingWord: ttsUseEnding,
          endingWord: ttsEndingWord
        }
      })

      toast.success(`เรียกคิว ${prefix}#${newNumbers.join(', #')} แล้ว`)
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setCalling(false)
    }
  }

  const handleRepeat = async () => {
    if (!session || session.current_numbers.length === 0) return
    const names = session.current_numbers.map(num => {
      const b = bookings.find(x => x.queue_number === num && x.status === 'called')
      return b ? getNameForBooking(b) : ''
    })
    
    supabase.channel(`queue:${eventId}`).send({
      type: 'broadcast',
      event: 'TTS_PLAY',
      payload: {
        language: session.language,
        queueNumbers: session.current_numbers,
        names,
        showName: ttsCallName,
        phrase: ttsPhrase,
        voiceGender: ttsVoiceGender,
        useEndingWord: ttsUseEnding,
        endingWord: ttsEndingWord
      }
    })
    toast.success('เรียกซ้ำแล้ว')
  }

  const handleMarkAbsent = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId)
    if (!booking) return
    await supabase.from('bookings').update({ status: 'absent' }).eq('id', booking.id)
    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: 'absent' as Booking['status'] } : b))
    toast.success(`คิว #${booking.queue_number} - ไม่มา`)
  }



  const waitingBookings = bookings.filter(b => b.status === 'waiting')
  const calledBookings = bookings.filter(b => b.status === 'called')
  const absentBookings = bookings.filter(b => b.status === 'absent')
  const currentNumbers = session?.current_numbers || []
  const prefix = (event?.settings as any)?.queue_prefix || ''
  const ttsPhrase = (event?.settings as any)?.tts_phrase || ''
  const ttsCallName = (event?.settings as any)?.tts_call_name ?? session?.show_name ?? true
  const ttsVoiceGender = (event?.settings as any)?.tts_voice_gender || 'female'
  const ttsUseEnding = (event?.settings as any)?.tts_use_ending ?? true
  const ttsEndingWord = (event?.settings as any)?.tts_ending_word || 'ค่ะ'

  if (loading) {
    return <div className="loading-overlay"><div className="spinner spinner-lg" /></div>
  }



  return (
    <div className="queue-control-page fade-in">
      <div className="control-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/organizer/events/${eventId}`)}>← กลับ</button>
        <div>
          <h1>📢 เรียกคิว</h1>
          <p>{event?.title}</p>
        </div>
        <a href={`/display/${eventId}`} target="_blank" className="btn btn-secondary btn-sm">
          🖥️ เปิดจอแสดงผล
        </a>
      </div>

      <div className="control-body">
        {/* Left: Control Panel */}
        <div className="control-panel">
          {/* Current queue */}
          <div className="current-queue-card">
            <div className="current-queue-label">คิวที่กำลังเรียก</div>
            {currentNumbers.length === 0 ? (
              <div className="current-queue-empty">กำลังรอเรียก</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
                <div className="current-queue-numbers">
                  {currentNumbers.map(num => {
                    const booking = bookings.find(b => b.queue_number === num && b.status === 'called')
                    const name = booking ? getNameForBooking(booking) : null
                    const slot = booking?.slot_id ? slots.find(s => s.id === booking.slot_id) : null
                    return (
                      <div key={num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div className="current-num" style={{ lineHeight: 1.1 }}>{prefix}{String(num).padStart(3, '0')}</div>
                        {name && <div style={{ fontSize: '1.25rem', color: 'var(--color-primary)', marginTop: '4px' }}>คุณ {name}</div>}
                        {slot && <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>รอบ {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)} น.</div>}
                      </div>
                    )
                  })}
                </div>
                <button 
                  className="btn btn-ghost btn-sm" 
                  style={{ fontSize: '0.75rem', opacity: 0.6 }}
                  onClick={async () => {
                    if (confirm('ต้องการรีเซ็ตคิวกลับเป็น "กำลังรอเรียก" หรือไม่?')) {
                      await supabase.from('queue_sessions').update({ current_numbers: [] }).eq('event_id', eventId)
                      setSession(prev => prev ? { ...prev, current_numbers: [] } : prev)
                    }
                  }}
                >
                  🔄 รีเซ็ตคิวที่กำลังเรียก
                </button>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="control-stats">
            <div className="control-stat">
              <div className="control-stat-value">{waitingBookings.length}</div>
              <div className="control-stat-label">รอ</div>
            </div>
            <div className="control-stat">
              <div className="control-stat-value">{calledBookings.length}</div>
              <div className="control-stat-label">เรียกแล้ว</div>
            </div>
            <div className="control-stat">
              <div className="control-stat-value">{bookings.filter(b => b.status === 'present').length}</div>
              <div className="control-stat-label">มาแล้ว</div>
            </div>
            <div className="control-stat">
              <div className="control-stat-value">{bookings.filter(b => b.status === 'absent').length}</div>
              <div className="control-stat-label">ไม่มา</div>
            </div>
          </div>

          {/* Buttons */}
          <div className="control-buttons">
            <button
              className="btn btn-primary btn-xl control-btn-main"
              onClick={handleCallNext}
              disabled={calling || waitingBookings.length === 0 || (event?.queue_type === 'scheduled' && unlockedSlotId === null)}
            >
              {calling ? (
                <><div className="spinner" /> กำลังเรียก...</>
              ) : (
                <>{currentNumbers.length === 0 ? '📢 เริ่มเรียกคิว' : '📢 เรียกคิวถัดไป'}</>
              )}
            </button>
            <div className="control-btn-row">
              <button
                className="btn btn-secondary"
                onClick={handleRepeat}
                disabled={currentNumbers.length === 0}
              >
                🔁 เรียกซ้ำ
              </button>
            </div>
          </div>

          {/* Settings reminder */}
          {session && (
            <div className="control-settings-info">
              <span>เรียกทีละ {session.call_count_per_round} คน</span>
              <span>·</span>
              <span>{session.language === 'th' ? '🇹🇭 ไทย' : '🇬🇧 English'}</span>
              <span>·</span>
              <span>{session.show_name ? '👤 แสดงชื่อ' : '🙈 ไม่แสดงชื่อ'}</span>
            </div>
          )}
        </div>

        {/* Right: Queue List */}
        <div className="queue-list-panel">
          {/* Called - mark absent */}
          {calledBookings.length > 0 && (
            <div className="queue-list-section">
              <div className="queue-list-header">
                <span>เรียกแล้ว ({calledBookings.length})</span>
              </div>
              {calledBookings.map(b => {
                const name = getNameForBooking(b)
                const slot = b.slot_id ? slots.find(s => s.id === b.slot_id) : null
                return (
                  <div key={b.id} className="queue-item queue-item-called">
                    <div style={{ flex: 1 }}>
                      <span className="queue-item-num">#{prefix}{String(b.queue_number).padStart(3, '0')}</span>
                      {name && <span className="queue-item-name">{name}</span>}
                      {slot && <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', marginLeft: '8px' }}>รอบ {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)} น.</span>}
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => handleMarkAbsent(b.id)}>ไม่มา</button>
                    <button className="btn btn-success btn-sm" onClick={async () => {
                      await supabase.from('bookings').update({ status: 'present' }).eq('id', b.id)
                      setBookings(prev => prev.map(x => x.id === b.id ? { ...x, status: 'present' as Booking['status'] } : x))
                      toast.success(`คิว #${b.queue_number} มาแล้ว`)
                    }}>มาแล้ว</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Absent - allow re-inserting */}
          {absentBookings.length > 0 && (
            <div className="queue-list-section">
              <div className="queue-list-header">
                ข้ามคิว / ไม่มา ({absentBookings.length})
              </div>
              {absentBookings.map(b => {
                const name = getNameForBooking(b)
                const slot = b.slot_id ? slots.find(s => s.id === b.slot_id) : null
                return (
                  <div key={b.id} className="queue-item" style={{ opacity: 0.8 }}>
                    <div style={{ flex: 1 }}>
                      <span className="queue-item-num" style={{ color: 'var(--color-danger)' }}>#{prefix}{String(b.queue_number).padStart(3, '0')}</span>
                      {name && <span className="queue-item-name">{name}</span>}
                      {slot && <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', marginLeft: '8px' }}>รอบ {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)} น.</span>}
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={async () => {
                      // Insert queue: Call immediately
                      const { error } = await supabase
                        .from('queue_sessions')
                        .update({ current_numbers: [b.queue_number] })
                        .eq('event_id', eventId)
                      if (!error) {
                        await supabase.from('bookings').update({ status: 'called', called_at: new Date().toISOString() }).eq('id', b.id)
                        setSession(prev => prev ? { ...prev, current_numbers: [b.queue_number] } : prev)
                        setBookings(prev => prev.map(x => x.id === b.id ? { ...x, status: 'called' as Booking['status'] } : x))
                        toast.success(`แทรกคิว #${prefix}${b.queue_number} แล้ว`)
                        if (session) {
                          supabase.channel(`queue:${eventId}`).send({
                            type: 'broadcast',
                            event: 'TTS_PLAY',
                            payload: {
                              language: session.language,
                              queueNumbers: [b.queue_number],
                              names: [name],
                              showName: ttsCallName,
                              phrase: ttsPhrase,
                              voiceGender: ttsVoiceGender,
                              useEndingWord: ttsUseEnding,
                              endingWord: ttsEndingWord
                            }
                          })
                        }
                      }
                    }}>เรียกแทรกคิว</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Waiting */}
          <div className="queue-list-section">
            <div className="queue-list-header">
              รอรับบริการ ({waitingBookings.length})
            </div>
            {waitingBookings.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                <div className="empty-state-icon">🎉</div>
                <div className="empty-state-title">เรียกคิวครบแล้ว!</div>
              </div>
            ) : event?.queue_type === 'scheduled' ? (
              slots.map(slot => {
                const slotBookings = waitingBookings.filter(b => b.slot_id === slot.id)
                if (slotBookings.length === 0) return null
                return (
                  <div key={slot.id} className="queue-slot-group" style={{ marginBottom: 'var(--space-4)' }}>
                    <div className="queue-slot-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                      <span>รอบ {slot.start_time.slice(0,5)} - {slot.end_time.slice(0,5)} ({slotBookings.length} คิว)</span>
                      {unlockedSlotId !== slot.id ? (
                        <button className="btn btn-primary btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => setUnlockedSlotId(slot.id)}>
                          เริ่มรอบนี้
                        </button>
                      ) : (
                        <span style={{ color: 'var(--color-success)', fontSize: '0.7rem' }}>✅ กำลังเรียก</span>
                      )}
                    </div>
                    {slotBookings.map(b => {
                      const name = getNameForBooking(b)
                      const isLocked = unlockedSlotId !== slot.id
                      return (
                        <div key={b.id} className="queue-item">
                          <span className="queue-item-num">#{prefix}{String(b.queue_number).padStart(3, '0')}</span>
                          {name && <span className="queue-item-name">{name}</span>}
                          <button className="btn btn-ghost btn-sm" disabled={isLocked} onClick={async () => {
                            if (isLocked) return
                            const { error } = await supabase
                              .from('queue_sessions')
                              .update({ current_numbers: [b.queue_number] })
                              .eq('event_id', eventId)
                            if (!error) {
                              await supabase.from('bookings').update({ status: 'called', called_at: new Date().toISOString() }).eq('id', b.id)
                              setSession(prev => prev ? { ...prev, current_numbers: [b.queue_number] } : prev)
                              setBookings(prev => prev.map(x => x.id === b.id ? { ...x, status: 'called' as Booking['status'] } : x))
                              toast.success(`เรียก #${prefix}${b.queue_number} แล้ว`)
                              if (session) {
                                supabase.channel(`queue:${eventId}`).send({
                                  type: 'broadcast',
                                  event: 'TTS_PLAY',
                                  payload: {
                                    language: session.language, queueNumbers: [b.queue_number], names: [name],
                                    showName: ttsCallName, phrase: ttsPhrase, voiceGender: ttsVoiceGender, useEndingWord: ttsUseEnding, endingWord: ttsEndingWord
                                  }
                                })
                              }
                            }
                          }}>เรียก</button>
                        </div>
                      )
                    })}
                  </div>
                )
              })
            ) : (
              waitingBookings.slice(0, 20).map(b => {
                const name = getNameForBooking(b)
                return (
                  <div key={b.id} className="queue-item">
                    <span className="queue-item-num">#{prefix}{String(b.queue_number).padStart(3, '0')}</span>
                    {name && <span className="queue-item-name">{name}</span>}
                    <button className="btn btn-ghost btn-sm" onClick={async () => {
                      // Add this specific person to front
                      const { error } = await supabase
                        .from('queue_sessions')
                        .update({ current_numbers: [b.queue_number] })
                        .eq('event_id', eventId)
                      if (!error) {
                        await supabase.from('bookings').update({ status: 'called', called_at: new Date().toISOString() }).eq('id', b.id)
                        setSession(prev => prev ? { ...prev, current_numbers: [b.queue_number] } : prev)
                        setBookings(prev => prev.map(x => x.id === b.id ? { ...x, status: 'called' as Booking['status'] } : x))
                        toast.success(`เรียก #${prefix}${b.queue_number} แล้ว`)
                        if (session) {
                          supabase.channel(`queue:${eventId}`).send({
                            type: 'broadcast',
                            event: 'TTS_PLAY',
                            payload: {
                              language: session.language, queueNumbers: [b.queue_number], names: [name],
                              showName: ttsCallName, phrase: ttsPhrase, voiceGender: ttsVoiceGender, useEndingWord: ttsUseEnding, endingWord: ttsEndingWord
                            }
                          })
                        }
                      }
                    }}>เรียก</button>
                  </div>
                )
              })
            )}
            {event?.queue_type !== 'scheduled' && waitingBookings.length > 20 && (
              <div style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                ...และอีก {waitingBookings.length - 20} คน
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
