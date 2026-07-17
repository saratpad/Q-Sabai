import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { QueueSession, Booking, Event, CustomField } from '../../lib/database.types'
import { speakQueue, loadVoices, unlockAudioContext } from '../../lib/tts'
import { useSystemStore } from '../../stores/systemStore'
import './QueueDisplayPage.css'

interface BookingDisplay extends Booking {
  field_responses: Record<string, string>
  event_slots?: any
}

interface TtsPayload {
  eventId: string
  payload: any
}

export default function QueueDisplayPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { systemName, systemDesc } = useSystemStore()
  
  const [parentEvent, setParentEvent] = useState<Event | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [sessions, setSessions] = useState<Record<string, QueueSession>>({})
  const [calledBookings, setCalledBookings] = useState<Record<string, BookingDisplay[]>>({})
  const [waitingCounts, setWaitingCounts] = useState<Record<string, number>>({})
  const [absentCounts, setAbsentCounts] = useState<Record<string, number>>({})
  const [nextWaitingBookings, setNextWaitingBookings] = useState<Record<string, BookingDisplay | null>>({})
  const [customFields, setCustomFields] = useState<Record<string, CustomField[]>>({})
  const [loading, setLoading] = useState(true)

  // Refs for tracking changing numbers and TTS queue
  const prevNumbersRef = useRef<Record<string, number[]>>({})
  const prefixRefs = useRef<Record<string, string>>({})
  const ttsQueueRef = useRef<TtsPayload[]>([])
  const isSpeakingRef = useRef(false)

  useEffect(() => {
    loadVoices()
    fetchInitialData()
    // We'll set up subscriptions after data is loaded
  }, [eventId])

  const processTtsQueue = async () => {
    if (isSpeakingRef.current || ttsQueueRef.current.length === 0) return
    isSpeakingRef.current = true

    while (ttsQueueRef.current.length > 0) {
      const nextTts = ttsQueueRef.current.shift()
      if (nextTts) {
        const p = nextTts.payload
        const eId = nextTts.eventId
        const prefix = prefixRefs.current[eId] || ''
        await speakQueue({
          language: p.language || 'th',
          queueNumbers: p.queueNumbers || [],
          prefix: prefix,
          names: p.names || [],
          showName: p.showName ?? true,
          phrase: p.phrase || '',
          voiceGender: p.voiceGender || 'female',
          useEndingWord: p.useEndingWord ?? true,
          endingWord: p.endingWord || 'ค่ะ',
          playChime: p.playChime ?? true,
          chimeStyle: p.chimeStyle || 'classic'
        }).catch(err => console.error("TTS Error:", err))
        
        // Add a small pause between announcements
        await new Promise(r => setTimeout(r, 1000))
      }
    }

    isSpeakingRef.current = false
  }

  const enqueueTts = (eventId: string, payload: any) => {
    ttsQueueRef.current.push({ eventId, payload })
    processTtsQueue()
  }

  const fetchInitialData = async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const { data: mainEvent } = await supabase.from('events').select('*').eq('id', eventId).single()
      if (!mainEvent) return

      setParentEvent(mainEvent)
      
      let targetEvents: Event[] = []
      if (mainEvent.is_group) {
        const { data: children } = await supabase.from('events').select('*').eq('parent_id', eventId).order('created_at', { ascending: true })
        targetEvents = children || []
      } else {
        targetEvents = [mainEvent]
      }
      
      setEvents(targetEvents)

      const eventIds = targetEvents.map(e => e.id)
      if (eventIds.length === 0) {
        setLoading(false)
        return
      }

      // Initialize prefixes
      const newPrefixes: Record<string, string> = {}
      targetEvents.forEach(e => {
        newPrefixes[e.id] = (e.settings as any)?.queue_prefix || ''
      })
      prefixRefs.current = newPrefixes

      // Fetch all sessions
      const { data: sessionsData } = await supabase.from('queue_sessions').select('*').in('event_id', eventIds)
      const newSessions: Record<string, QueueSession> = {}
      sessionsData?.forEach(s => {
        newSessions[s.event_id] = s
        prevNumbersRef.current[s.event_id] = s.current_numbers
      })
      setSessions(newSessions)

      // Fetch all current called bookings
      const currentNums = sessionsData?.flatMap(s => s.current_numbers) || []
      const newCalledBookings: Record<string, BookingDisplay[]> = {}
      if (currentNums.length > 0) {
        const { data: bookingsData } = await supabase.from('bookings').select('*, event_slots(*)').in('event_id', eventIds).in('queue_number', currentNums)
        bookingsData?.forEach(b => {
          if (!newCalledBookings[b.event_id]) newCalledBookings[b.event_id] = []
          newCalledBookings[b.event_id].push(b as BookingDisplay)
        })
      }
      setCalledBookings(newCalledBookings)

      // Fetch all custom fields
      const { data: fieldsData } = await supabase.from('custom_fields').select('*').in('event_id', eventIds)
      const newFields: Record<string, CustomField[]> = {}
      fieldsData?.forEach(f => {
        if (!newFields[f.event_id]) newFields[f.event_id] = []
        newFields[f.event_id].push(f)
      })
      setCustomFields(newFields)

      // Fetch waiting counts
      await fetchWaitingCounts(eventIds)

      setupSubscriptions(eventIds)
    } finally {
      setLoading(false)
    }
  }

  const fetchWaitingCounts = async (eventIds: string[]) => {
    const wCounts: Record<string, number> = {}
    const aCounts: Record<string, number> = {}
    const nextBookings: Record<string, BookingDisplay | null> = {}
    
    for (const id of eventIds) {
      const [waitingRes, absentRes, nextRes] = await Promise.all([
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('event_id', id).eq('status', 'waiting'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('event_id', id).eq('status', 'absent'),
        supabase.from('bookings').select('*').eq('event_id', id).eq('status', 'waiting').order('queue_number', { ascending: true }).limit(1)
      ])
      wCounts[id] = waitingRes.count || 0
      aCounts[id] = absentRes.count || 0
      nextBookings[id] = nextRes.data && nextRes.data.length > 0 ? (nextRes.data[0] as BookingDisplay) : null
    }
    
    setWaitingCounts(prev => ({ ...prev, ...wCounts }))
    setAbsentCounts(prev => ({ ...prev, ...aCounts }))
    setNextWaitingBookings(prev => ({ ...prev, ...nextBookings }))
  }

  const setupSubscriptions = (eventIds: string[]) => {
    eventIds.forEach(id => {
      supabase
        .channel(`queue:${id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'queue_sessions',
          filter: `event_id=eq.${id}`,
        }, async (payload) => {
          const newSession = payload.new as QueueSession
          setSessions(prev => ({ ...prev, [id]: newSession }))
          
          const newNums = newSession.current_numbers
          if (JSON.stringify(newNums) !== JSON.stringify(prevNumbersRef.current[id])) {
            prevNumbersRef.current[id] = newNums
            if (newNums.length > 0) {
              const { data } = await supabase.from('bookings').select('*, event_slots(*)').eq('event_id', id).in('queue_number', newNums)
              if (data) {
                setCalledBookings(prev => ({ ...prev, [id]: data as BookingDisplay[] }))
              }
            }
          }
        })
        .on('broadcast', { event: 'TTS_PLAY' }, (payload) => {
          enqueueTts(id, payload.payload)
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `event_id=eq.${id}`,
        }, () => {
          fetchWaitingCounts([id])
        })
        .subscribe()
    })
  }

  const [audioEnabled, setAudioEnabled] = useState(false)

  const enableAudio = async () => {
    setAudioEnabled(true)
    await unlockAudioContext()
  }

  const getNameForBooking = (eventId: string, booking: BookingDisplay) => {
    const responses = booking.field_responses || {}
    const fields = customFields[eventId] || []
    const firstField = fields.find(f => f.field_type === 'text')
    if (firstField && responses[firstField.id]) return responses[firstField.id]
    return Object.values(responses)[0] || ''
  }

  if (loading) {
    return (
      <div className="queue-display">
        <div className="spinner spinner-lg" style={{ borderTopColor: '#0ea5e9' }} />
      </div>
    )
  }

  // Audio activation overlay (Autoplay Policy resolution)
  if (!audioEnabled) {
    return (
      <div className="queue-display" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', color: '#fff', cursor: 'pointer' }} onClick={enableAudio}>
        <div style={{ padding: '40px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center', maxWidth: '480px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📢</div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 600, marginBottom: '12px' }}>คลิกเพื่อเปิดระบบเรียกคิว</h2>
          <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.5, marginBottom: '24px' }}>
            เพื่อปฏิบัติตามนโยบายความปลอดภัยของเบราว์เซอร์ กรุณาคลิกหนึ่งครั้งเพื่อเปิดใช้งานเสียงเรียกและเสียงเอฟเฟกต์นำ
          </p>
          <button className="btn btn-primary" style={{ padding: '12px 32px', fontSize: '1.1rem', width: '100%' }}>
            🔊 เริ่มเปิดใช้งานเสียง
          </button>
        </div>
      </div>
    )
  }

  // --- RENDER GROUP DISPLAY ---
  if (parentEvent?.is_group) {
    return (
      <div className="queue-display">
        {/* Background particles */}
        <div className="display-particles">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 6}s`,
              animationDuration: `${6 + Math.random() * 6}s`,
            }} />
          ))}
        </div>

        <div className="queue-display-right" style={{ width: '100%' }}>
          <div className="queue-display-header" style={{ marginBottom: '16px' }}>
            <div className="queue-display-title">{parentEvent.title}</div>
            <div className="queue-display-subtitle">{systemName} {systemDesc ? `· ${systemDesc}` : ''}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', padding: '0 24px', width: '100%', height: 'calc(100vh - 180px)', overflowY: 'auto' }}>
            {events.map(ev => {
              const session = sessions[ev.id]
              const showNumbers = session?.current_numbers || []
              const prefix = prefixRefs.current[ev.id] || ''
              const called = calledBookings[ev.id] || []
              
              return (
                <div key={ev.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
                    {ev.banner_url && (
                      <img src={ev.banner_url} alt={ev.title} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} />
                    )}
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.5rem' }}>{ev.title}</h3>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '0.9rem', marginTop: '4px' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>รออีก {waitingCounts[ev.id] || 0} คิว</span>
                        <span style={{ color: 'var(--color-danger-light)' }}>ไม่มา {absentCounts[ev.id] || 0} คิว</span>
                      </div>
                    </div>
                  </div>

                  <div className="queue-number-display" style={{ flex: 1, padding: 0 }}>
                    {showNumbers.length === 0 ? (
                      <div className="waiting-start" style={{ padding: '24px 0' }}>
                        <div className="waiting-start-icon" style={{ fontSize: '3rem' }}>🎟️</div>
                        <div className="waiting-start-text" style={{ fontSize: '1.2rem' }}>กำลังรอเริ่มเรียกคิว</div>
                      </div>
                    ) : (
                      showNumbers.map(num => {
                        const sortedCalled = [...called].sort((a, b) => new Date(b.called_at || 0).getTime() - new Date(a.called_at || 0).getTime())
                        const booking = sortedCalled.find(b => b.queue_number === num)
                        const name = booking && session?.show_name ? getNameForBooking(ev.id, booking) : null
                        return (
                          <div key={num} className="queue-number-card slide-up" style={{ padding: '16px', marginBottom: '8px' }}>
                            <div className="queue-number-value" style={{ fontSize: 'clamp(3.5rem, 6vw, 6rem)', lineHeight: 1.1 }}>
                              {prefix}{String(num).padStart(3, '0')}
                            </div>
                            {name && <div className="queue-number-name" style={{ fontSize: 'clamp(1.25rem, 2vw, 2rem)', marginTop: '8px' }}>คุณ {name}</div>}
                            {booking?.event_slots && (
                              <div className="queue-number-slot" style={{ fontSize: 'clamp(0.875rem, 1.2vw, 1.25rem)', color: 'var(--color-primary)', marginTop: '4px', fontWeight: 600 }}>
                                รอบ {booking.event_slots.start_time.slice(0, 5)} - {booking.event_slots.end_time.slice(0, 5)} น.
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="queue-display-footer" style={{ padding: '12px 32px' }}>
            <div className="display-time">
              {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- RENDER SINGLE EVENT DISPLAY ---
  const session = sessions[parentEvent!.id]
  const showNumbers = session?.current_numbers || []
  const called = calledBookings[parentEvent!.id] || []
  const prefix = prefixRefs.current[parentEvent!.id] || ''

  return (
    <div className="queue-display">
      {/* Background particles */}
      <div className="display-particles">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 6}s`,
            animationDuration: `${6 + Math.random() * 6}s`,
          }} />
        ))}
      </div>

      {/* Split Layout: Left Banner */}
      {parentEvent?.banner_url && (
        <div className="queue-display-left">
          <img src={parentEvent.banner_url} alt={parentEvent.title} className="display-banner-large" />
        </div>
      )}

      {/* Split Layout: Right Queue Content */}
      <div className="queue-display-right" style={{ flex: parentEvent?.banner_url ? 1 : 'none', width: parentEvent?.banner_url ? '50%' : '100%' }}>
        {/* Header */}
        <div className="queue-display-header">
          <div className="queue-display-title">{parentEvent?.title || 'ระบบจัดคิว'}</div>
          <div className="queue-display-subtitle">{systemName} {systemDesc ? `· ${systemDesc}` : ''}</div>
        </div>

        {/* Queue numbers */}
        <div className="queue-number-display">
          {showNumbers.length === 0 ? (
            <div className="waiting-start">
              <div className="waiting-start-icon">🎟️</div>
              <div className="waiting-start-text">กำลังรอเริ่มเรียกคิว</div>
              <div className="waiting-start-sub">ผู้จองกรุณารอสักครู่...</div>
            </div>
          ) : (
            showNumbers.map(num => {
              const sortedCalled = [...called].sort((a, b) => new Date(b.called_at || 0).getTime() - new Date(a.called_at || 0).getTime())
              const booking = sortedCalled.find(b => b.queue_number === num)
              const name = booking && session?.show_name ? getNameForBooking(parentEvent!.id, booking) : null
              return (
                <div key={num} className="queue-number-card slide-up">
                  <div className="queue-label">กรุณาเข้ารับบริการ</div>
                  <div className="queue-number-value">
                    {prefix}{String(num).padStart(3, '0')}
                  </div>
                  {name && <div className="queue-number-name">คุณ {name}</div>}
                  {booking?.event_slots && (
                    <div className="queue-number-slot" style={{ fontSize: 'clamp(1rem, 1.5vw, 1.5rem)', color: 'var(--color-primary)', marginTop: '8px', fontWeight: 600 }}>
                      รอบ {booking.event_slots.start_time.slice(0, 5)} - {booking.event_slots.end_time.slice(0, 5)} น.
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="queue-display-footer">
          <div className="queue-waiting-count" style={{ display: 'flex', gap: '24px' }}>
            <span>⏳ รอรับบริการอีก <strong>{waitingCounts[parentEvent!.id] || 0}</strong> คน</span>
            <span style={{ color: 'var(--color-danger-light)' }}>❌ ข้าม/ไม่มา <strong>{absentCounts[parentEvent!.id] || 0}</strong> คน</span>
          </div>
          <div className="display-time">
            {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  )
}
