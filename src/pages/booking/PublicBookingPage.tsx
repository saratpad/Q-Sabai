import { useEffect, useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useSystemStore } from '../../stores/systemStore'
import type { Event, EventSlot, CustomField, Booking } from '../../lib/database.types'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { formatThaiSlotDate, formatThaiDateTime } from '../../lib/thaiDate'
import toast from 'react-hot-toast'
import { TicketCard } from '../../components/ticket/TicketCard'
import type { SlotCardItemKey } from '../../components/ticket/ticketTypes'
import {
  PAGE_TITLE_SIZES,
  PAGE_DESC_SIZES,
  PAGE_SLOT_HEADER_SIZES,
  PAGE_SLOT_TIME_SIZES,
  PAGE_SLOT_DATE_SIZES,
  PAGE_SLOT_QUOTA_SIZES,
  PAGE_SLOT_CARD_SIZES,
} from '../../components/ticket/ticketTypes'
import { FormattedText } from '../../components/common/FormattedText'
import './PublicBookingPage.css'

function findPhoneField(fields: CustomField[]) {
  return fields.find(f => f.field_type === 'phone') || 
         fields.find(f => /โทร|phone|tel|มือถือ/i.test(f.label))
}

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

  const isTicketEnabled = (event?.settings as any)?.ticket_enabled !== false

  useEffect(() => {
    if (step === 'done' && myBooking && !ticketDownloaded && isTicketEnabled) {
      const timer = setTimeout(() => {
        handleDownloadTicket()
        setTicketDownloaded(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [step, myBooking, ticketDownloaded, isTicketEnabled])

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
    if (!ticketRef.current || !event || !isTicketEnabled) return
    try {
      const canvas = await html2canvas(ticketRef.current, { 
        backgroundColor: null, 
        scale: 2,
        useCORS: true,
        allowTaint: false
      })
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

      // Restore from localStorage unless allow_duplicate is enabled
      const allowDuplicate = (eventRes.data?.settings as any)?.allow_duplicate ?? false
      if (!allowDuplicate) {
        const localBookingId = localStorage.getItem('booking_' + eventId)
        if (localBookingId) {
          const { data } = await supabase.from('bookings').select('*').eq('id', localBookingId).maybeSingle()
          if (data && data.status !== 'cancelled') {
            setMyBooking(data)
            setStep('done')
          }
        }
      } else {
        // allow_duplicate: always clear old token so user gets fresh form
        localStorage.removeItem('booking_' + eventId)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBook = async () => {
    if (!event) return

    // Validate fields
    for (const field of customFields) {
      let val = (fieldValues[field.id] || '').trim()
      if (field.is_required && !val) {
        toast.error(`กรุณากรอก ${field.label}`)
        return
      }

      // Phone number validation
      const isPhoneField = field.field_type === 'phone' || /โทร|phone|tel|มือถือ/i.test(field.label)
      if (isPhoneField && val) {
        // Extract all digits to verify primary phone number
        const digits = val.replace(/\D/g, '')
        let normDigits = digits
        if (normDigits.startsWith('66') && normDigits.length >= 11) {
          normDigits = '0' + normDigits.slice(2)
        }

        // Support mobile (10 digits), landline (9 digits), and extensions (e.g. 025779000 ต่อ 9382)
        if (!normDigits.startsWith('0') || normDigits.length < 9) {
          toast.error(`กรุณากรอก ${field.label} ให้ถูกต้อง (อย่างน้อย 9-10 หลัก เช่น 0891234567 หรือ 025779000 ต่อ 9382)`)
          return
        }
        // Save trimmed phone value (preserving extension notes like "ต่อ 9382")
        fieldValues[field.id] = val.trim()
      }
    }

    if ((event.settings as any)?.allow_multiple_bookings === false) {
      const phoneField = findPhoneField(customFields)
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
      const phoneField = findPhoneField(customFields)
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
      const phoneField = findPhoneField(customFields)
      const phoneValue = phoneField ? fieldValues[phoneField.id] : null

      let resolvedBooking: any = null
      if (phoneValue) {
        const { data: bData } = await supabase.rpc('get_my_booking_by_phone', {
          p_event_id: event.id,
          p_phone: phoneValue
        })

        if (bData && bData.length > 0) {
          resolvedBooking = bData[0]
        }
      }

      if (!resolvedBooking) {
        resolvedBooking = {
          id: '',
          event_id: event.id,
          slot_id: selectedSlot?.id || null,
          user_id: user?.id || null,
          queue_number: 1,
          status: 'waiting',
          field_responses: fieldValues,
          created_at: new Date().toISOString()
        }
      }

      setMyBooking(resolvedBooking)
      if (resolvedBooking.id) {
        localStorage.setItem('booking_' + eventId, resolvedBooking.id)
      }

      setTicketDownloaded(false)
      setTicketImageUrl(null)
      setStep('done')
      toast.success(isTicketEnabled ? 'จองคิวสำเร็จ! 🎉' : 'จองสำเร็จแล้ว! 🎉')
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
    const rawInput = cancelPhone.trim()
    if (!rawInput) {
      toast.error('กรุณากรอกเบอร์โทรศัพท์ที่ใช้จอง')
      return
    }

    const digitsOnly = rawInput.replace(/\D/g, '')
    if (digitsOnly.length < 6) {
      toast.error('กรุณากรอกเบอร์โทรศัพท์อย่างน้อย 9 หลัก เช่น 0891234567 หรือ 025779000 ต่อ 9382')
      return
    }

    // Extract base phone number without extension
    let basePhone = digitsOnly
    if (basePhone.startsWith('66') && basePhone.length >= 11) {
      basePhone = '0' + basePhone.slice(2)
    }
    if (basePhone.length > 10 && basePhone.startsWith('02')) {
      basePhone = basePhone.slice(0, 9)
    } else if (basePhone.length > 10 && basePhone.startsWith('0')) {
      basePhone = basePhone.slice(0, 10)
    }

    setCancelLoading(true)
    setHasSearched(false)
    setCancelBookingsList([])

    let allBookings: any[] = []

    const searchPhoneInEvent = async (eId: string, eventTitle: string) => {
      // 1. Search with raw input (e.g. "025779000 ต่อ 9382")
      const { data: rawData } = await supabase.rpc('get_my_booking_by_phone', {
        p_event_id: eId,
        p_phone: rawInput
      })
      if (rawData && rawData.length > 0) {
        return rawData.map((b: any) => ({ ...b, event_title: eventTitle, _event_id: eId }))
      }

      // 2. Search with base phone (e.g. "025779000")
      if (basePhone && basePhone !== rawInput) {
        const { data: baseData } = await supabase.rpc('get_my_booking_by_phone', {
          p_event_id: eId,
          p_phone: basePhone
        })
        if (baseData && baseData.length > 0) {
          return baseData.map((b: any) => ({ ...b, event_title: eventTitle, _event_id: eId }))
        }
      }

      // 3. Search with full digits only (e.g. "0257790009382")
      if (digitsOnly && digitsOnly !== rawInput && digitsOnly !== basePhone) {
        const { data: digitsData } = await supabase.rpc('get_my_booking_by_phone', {
          p_event_id: eId,
          p_phone: digitsOnly
        })
        if (digitsData && digitsData.length > 0) {
          return digitsData.map((b: any) => ({ ...b, event_title: eventTitle, _event_id: eId }))
        }
      }

      return []
    }

    if (event?.is_group) {
      const promises = childEvents.map(child => searchPhoneInEvent(child.id, child.title))
      const results = await Promise.all(promises)
      allBookings = results.flat()
    } else if (eventId) {
      allBookings = await searchPhoneInEvent(eventId, event?.title || '')
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
        const possibleNames = Object.values(responses).filter(v => typeof v === 'string' && !/^0\d{8,9}$/.test(v.replace(/[-\s]/g, '')))
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

  const handleCancelSpecificBooking = async (bEventId: string, bPhone: string, bBookingId?: string) => {
    if (!confirm('ต้องการยกเลิกการจองนี้ใช่ไหม?')) return

    const { data: cancelSuccess } = await supabase.rpc('cancel_booking_by_phone', {
      p_event_id: bEventId,
      p_phone: bPhone,
      ...(bBookingId ? { p_booking_id: bBookingId } : {})
    })

    if (cancelSuccess) {
      toast.success('ยกเลิกการจองเรียบร้อยแล้ว')
      // Refetch
      handleSearchAndCancel()
      // If the cancelled booking was the current myBooking, clear it
      if (myBooking && (myBooking.id === bBookingId || bEventId === eventId)) {
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

  const pageSettings = (event.settings as any) || {}
  const slotUnit = pageSettings.slot_unit || pageSettings.capacity_unit || 'ที่'
  const pageTitleColor = pageSettings.page_title_color || undefined
  const pageTitleSize = pageSettings.page_title_size ? (PAGE_TITLE_SIZES[pageSettings.page_title_size as keyof typeof PAGE_TITLE_SIZES]?.fontSize) : undefined
  const pageDescColor = pageSettings.page_desc_color || undefined
  const pageDescSize = pageSettings.page_desc_size ? (PAGE_DESC_SIZES[pageSettings.page_desc_size as keyof typeof PAGE_DESC_SIZES]?.fontSize) : undefined
  const pageSlotHeaderColor = pageSettings.page_slot_header_color || (pageSettings.page_card_theme === 'light' ? '#1e293b' : undefined)
  const pageSlotHeaderSize = pageSettings.page_slot_header_size ? (PAGE_SLOT_HEADER_SIZES[pageSettings.page_slot_header_size as keyof typeof PAGE_SLOT_HEADER_SIZES]?.fontSize) : undefined
  const pageSlotTimeColor = pageSettings.page_slot_time_color || (pageSettings.page_card_theme === 'light' ? '#1e293b' : undefined)
  const pageSlotTimeSize = pageSettings.page_slot_time_size ? (PAGE_SLOT_TIME_SIZES[pageSettings.page_slot_time_size as keyof typeof PAGE_SLOT_TIME_SIZES]?.fontSize) : undefined
  const pageSlotDateColor = pageSettings.page_slot_date_color || (pageSettings.page_card_theme === 'light' ? '#475569' : '#94a3b8')
  const pageSlotDateSize = pageSettings.page_slot_date_size ? (PAGE_SLOT_DATE_SIZES[pageSettings.page_slot_date_size as keyof typeof PAGE_SLOT_DATE_SIZES]?.fontSize) : undefined
  const pageSlotQuotaColor = pageSettings.page_slot_quota_color || undefined
  const pageSlotQuotaSize = pageSettings.page_slot_quota_size ? (PAGE_SLOT_QUOTA_SIZES[pageSettings.page_slot_quota_size as keyof typeof PAGE_SLOT_QUOTA_SIZES]?.fontSize) : undefined
  const pageSlotCardPadding = pageSettings.page_slot_card_size ? (PAGE_SLOT_CARD_SIZES[pageSettings.page_slot_card_size as keyof typeof PAGE_SLOT_CARD_SIZES]?.padding) : undefined

  const rawSlotOrder = pageSettings.page_slot_order
  const completeSlotOrder: SlotCardItemKey[] = (() => {
    const base: SlotCardItemKey[] = ['time', 'date', 'quota']
    if (!Array.isArray(rawSlotOrder)) return base
    const valid = rawSlotOrder.filter((k: SlotCardItemKey) => base.includes(k))
    const remaining = base.filter(k => !valid.includes(k))
    return [...valid, ...remaining]
  })()
  const pageBgType = pageSettings.page_bg_type || 'default'
  const pageBgColor = pageSettings.page_bg_color || undefined
  const pageBgImage = pageSettings.page_bg_image || null
  const pageBgOverlay = pageSettings.page_bg_overlay ?? 30
  const pageCardTheme = pageSettings.page_card_theme || 'glass'
  const pageFormLabelColor = pageSettings.page_form_label_color || undefined
  const pageFormLabelWeightMap: Record<string, string> = {
    normal: '400', medium: '500', semibold: '600', bold: '700'
  }
  const pageFormLabelWeight = pageSettings.page_form_label_weight
    ? pageFormLabelWeightMap[pageSettings.page_form_label_weight] || '500'
    : '500'

  return (
    <div
      className={`booking-page-container theme-${pageCardTheme}`}
      style={{
        backgroundColor: pageBgType === 'color' && pageBgColor ? pageBgColor : undefined,
        backgroundImage: pageBgType === 'image' && pageBgImage ? `url("${pageBgImage}")` : undefined,
      }}
    >
      {pageBgType === 'image' && pageBgImage && (
        <div
          className="booking-page-bg-overlay"
          style={{ backgroundColor: `rgba(0, 0, 0, ${pageBgOverlay / 100})` }}
        />
      )}
      <div className="booking-page fade-in">
      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="modal-overlay fade-in" onClick={() => setShowCancelModal(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ padding: 'var(--space-6)', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 'var(--space-2)' }}>🔍 ค้นหาการจองของคุณ</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', fontSize: '0.875rem' }}>
              กรอกเบอร์โทรศัพท์ที่ใช้ในการจองเพื่อดูข้อมูลหรือยกเลิกคิว (เช่น 0891234567 หรือ 025779000 ต่อ 9382)
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                type="text"
                className="form-input"
                placeholder="เช่น 0891234567 หรือ 025779000 ต่อ 9382"
                value={cancelPhone}
                onChange={e => {
                  setCancelPhone(e.target.value)
                  if (cancelStep !== 'search') {
                    setCancelStep('search')
                    setHasSearched(false)
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleSearchAndCancel()
                  }
                }}
                maxLength={100}
                style={{ flex: 1 }}
              />
              <button 
                className="btn btn-primary" 
                onClick={handleSearchAndCancel} 
                disabled={cancelLoading || cancelPhone.trim().replace(/\D/g, '').length < 6}
              >
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
                      const statusText = b.status === 'waiting' ? 'รอเรียก' : b.status === 'called' ? 'เรียกแล้ว' : b.status === 'completed' ? 'เสร็จสิ้น' : b.status
                      return (
                        <div key={b.id} style={{ padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', gap: '12px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.event_title}</div>
                            <div style={{ color: 'var(--color-primary)', fontSize: '0.95rem', fontWeight: 600 }}>คิวหมายเลข {formattedQueue}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>สถานะ: {statusText}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setMyBooking(b)
                                setStep('done')
                                setShowCancelModal(false)
                                if (b._event_id) {
                                  localStorage.setItem('booking_' + b._event_id, b.id)
                                }
                                const bIsTicketEnabled = (bEvent?.settings as any)?.ticket_enabled !== false
                                toast.success(bIsTicketEnabled ? 'แสดงข้อมูลบัตรคิว' : 'แสดงข้อมูลการจอง')
                              }}
                            >
                              {(bEvent?.settings as any)?.ticket_enabled !== false ? '🎫 ดูบัตรคิว' : '📋 ดูข้อมูลการจอง'}
                            </button>
                            {b.status === 'waiting' && (
                              <button 
                                className="btn btn-danger btn-sm" 
                                onClick={() => handleCancelSpecificBooking(b._event_id, cancelPhone.trim().replace(/[-\s]/g, ''), b.id)}
                              >
                                ยกเลิก
                              </button>
                            )}
                          </div>
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
            <h1
              className="booking-event-title"
              style={{
                wordBreak: 'break-word',
                color: pageTitleColor,
                fontSize: pageTitleSize,
              }}
            >
              {event.title}
            </h1>
            {isEventOpen ? (
              <span className="badge badge-active">● เปิดรับจอง</span>
            ) : (
              <span className="badge badge-closed">✕ ปิดแล้ว</span>
            )}
          </div>
          {event.description && (
            <div
              className="booking-event-desc"
              style={{
                color: pageDescColor,
                fontSize: pageDescSize,
              }}
            >
              <FormattedText text={event.description} />
            </div>
          )}
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
          {isTicketEnabled ? (
            <>
              <div className="booking-success-icon">🎫</div>
              <div className="booking-success-title">จองคิวสำเร็จ!</div>

              {ticketImageUrl ? (
                <img 
                  src={ticketImageUrl} 
                  alt="Ticket" 
                  style={{ width: '100%', maxWidth: '320px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', marginBottom: '16px' }} 
                />
              ) : (
                <TicketCard
                  ticketRef={ticketRef}
                  settings={(event.settings as any) || {}}
                  queueNumber={`${(event.settings as any)?.queue_prefix || ''}${String(myBooking.queue_number).padStart(3, '0')}`}
                  eventTitle={event.title}
                  slotInfo={myBooking.slot_id && slots.find(s => s.id === myBooking.slot_id) ? `รอบ: ${slots.find(s => s.id === myBooking.slot_id)?.start_time.slice(0, 5)} - ${slots.find(s => s.id === myBooking.slot_id)?.end_time.slice(0, 5)} น.` : null}
                  dateStr={formatThaiDateTime(myBooking.created_at)}
                />
              )}

              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center' }}>
                กรุณารอฟังเรียกหมายเลขคิวของคุณ <br /> (หากไม่ได้ภาพตั๋ว สามารถกดค้างที่รูปภาพเพื่อบันทึกได้)
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {ticketImageUrl && (
                  <button className="btn btn-secondary btn-sm" onClick={handleDownloadTicket}>
                    📥 บันทึกตั๋วคิว
                  </button>
                )}
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
            </>
          ) : (
            /* รูปแบบไม่ใช้ตั๋วคิว (Ticket Mode ปิดอยู่): แสดงเฉพาะรายละเอียดผู้จองที่กรอกข้อมูลเข้ามา และระบุว่าจองสำเร็จแล้ว */
            <div className="booking-nonticket-card">
              <div className="booking-nonticket-header">
                <div className="booking-nonticket-icon">✅</div>
                <h2 className="booking-nonticket-title">จองสำเร็จแล้ว</h2>
                <p className="booking-nonticket-subtitle">
                  ระบบได้บันทึกข้อมูลการจองของคุณเรียบร้อยแล้ว
                </p>
              </div>

              <div className="booking-details-summary-card">
                <div className="booking-details-header">
                  <div className="booking-details-heading" style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.15rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>📋</span>
                    <span style={{ color: '#ffffff', fontWeight: 800 }}>ข้อมูลการลงทะเบียน</span>
                  </div>
                  <span className="badge" style={{ fontSize: '0.8rem', padding: '4px 10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600 }}>
                    สถานะ: จองสำเร็จ
                  </span>
                </div>

                <div className="booking-details-list">
                  {/* ชื่องาน / กิจกรรม */}
                  <div className="booking-details-row">
                    <span className="booking-details-label">กิจกรรม</span>
                    <span className="booking-details-value" style={{ fontWeight: 700 }}>
                      {event.title}
                    </span>
                  </div>

                  {/* วันที่ และรอบเวลา */}
                  {(() => {
                    const bookedSlot = myBooking.slot_id 
                      ? (slots.find(s => s.id === myBooking.slot_id) || (myBooking as any).event_slots)
                      : null
                    if (!bookedSlot) return null
                    return (
                      <>
                        {bookedSlot.slot_date && (
                          <div className="booking-details-row">
                            <span className="booking-details-label">วันที่</span>
                            <span className="booking-details-value" style={{ fontWeight: 600 }}>
                              {formatThaiSlotDate(bookedSlot.slot_date)}
                            </span>
                          </div>
                        )}
                        <div className="booking-details-row">
                          <span className="booking-details-label">รอบเวลา</span>
                          <span className="booking-details-value highlight">
                            {bookedSlot.start_time.slice(0, 5)} - {bookedSlot.end_time.slice(0, 5)} น.
                          </span>
                        </div>
                      </>
                    )
                  })()}

                  <div className="booking-details-divider" />

                  {/* รายละเอียดผู้จองที่กรอกข้อมูลเข้ามา */}
                  {(() => {
                    const responses = (myBooking.field_responses || fieldValues || {}) as Record<string, any>
                    const rows: { label: string; value: string }[] = []
                    const seenKeys = new Set<string>()

                    // 1. ตาม customFields
                    customFields.forEach(f => {
                      const val = responses[f.id]
                      if (val !== undefined && val !== null && String(val).trim() !== '') {
                        const displayVal = Array.isArray(val) ? val.join(', ') : String(val)
                        rows.push({ label: f.label, value: displayVal })
                        seenKeys.add(f.id)
                      }
                    })

                    // 2. Extra keys ถ้ามี
                    Object.entries(responses).forEach(([k, v]) => {
                      if (!seenKeys.has(k) && v !== undefined && v !== null && String(v).trim() !== '') {
                        const displayVal = Array.isArray(v) ? v.join(', ') : String(v)
                        rows.push({ label: k, value: displayVal })
                      }
                    })

                    if (rows.length === 0) {
                      return (
                        <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '6px 0', fontSize: '0.875rem' }}>
                          ไม่มีข้อมูลเพิ่มเติมที่กรอกเข้ามา
                        </div>
                      )
                    }

                    return rows.map((r, idx) => (
                      <div key={idx} className="booking-details-row">
                        <span className="booking-details-label">{r.label}</span>
                        <span className="booking-details-value">{r.value}</span>
                      </div>
                    ))
                  })()}

                  <div className="booking-details-divider" />

                  {/* ลำดับที่ / หมายเลขคิว */}
                  <div className="booking-details-row">
                    <span className="booking-details-label">ลำดับที่</span>
                    <span className="booking-details-value highlight">
                      {`${(event.settings as any)?.queue_prefix || ''}${String(myBooking.queue_number).padStart(3, '0')}`}
                    </span>
                  </div>

                  {/* วันเวลาที่ทำรายการ */}
                  <div className="booking-details-row">
                    <span className="booking-details-label">วันที่ทำรายการ</span>
                    <span className="booking-details-value" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      {formatThaiDateTime(myBooking.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="booking-nonticket-actions">
                <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
                  🖨️ พิมพ์ข้อมูลการจอง
                </button>
                <button className="btn btn-danger btn-sm" onClick={handleCloseWindow}>
                  ✕ ปิดหน้าต่าง
                </button>
                {event.parent_id && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (eventId) {
                        localStorage.removeItem('booking_' + eventId)
                      }
                      window.location.href = `/book/${event.parent_id}`
                    }}
                    style={{ border: '1px solid var(--color-border)' }}
                  >
                    ✕ เลือกกิจกรรมอื่น
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Booking Form */}
      {step === 'view' && isEventOpen && !event.is_group && (
        <>
          {/* Scheduled: Slot picker */}
          {event.queue_type === 'scheduled' && slots.length > 0 && (
            <div className="booking-section glass-card">
              <h2
                style={{
                  color: pageSlotHeaderColor,
                  fontSize: pageSlotHeaderSize,
                }}
              >
                เลือกรอบเวลา
              </h2>
              <div className="slot-grid">
                {slots.map(slot => {
                  const isFull = slot.status === 'full' || slot.booked_count >= slot.capacity
                  const isClosed = slot.status === 'closed'
                  const available = slot.capacity - slot.booked_count
                  return (
                    <div
                      key={slot.id}
                      className={`slot-card ${isFull ? 'slot-card-full' : ''} ${isClosed ? 'slot-card-closed' : ''} ${selectedSlot?.id === slot.id ? 'selected' : ''}`}
                      style={{ padding: pageSlotCardPadding }}
                      onClick={() => { if (!isFull && !isClosed) setSelectedSlot(slot) }}
                    >
                      {completeSlotOrder.map((itemKey, idx) => {
                        if (itemKey === 'time') {
                          return (
                            <div
                              key="time"
                              className="slot-time"
                              style={{
                                color: pageSlotTimeColor,
                                fontSize: pageSlotTimeSize,
                                marginTop: idx > 0 ? 'var(--space-1)' : 0,
                              }}
                            >
                              {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                            </div>
                          )
                        }
                        if (itemKey === 'date') {
                          return (
                            <div
                              key="date"
                              className="slot-capacity"
                              style={{
                                color: pageSlotDateColor,
                                fontSize: pageSlotDateSize,
                                marginTop: idx > 0 ? 'var(--space-1)' : 0,
                              }}
                            >
                              {formatThaiSlotDate(slot.slot_date)}
                            </div>
                          )
                        }
                        if (itemKey === 'quota') {
                          return (
                            <div
                              key="quota"
                              style={{ marginTop: idx > 0 ? 'var(--space-1)' : 0 }}
                            >
                              {isFull ? (
                                <div style={{ fontSize: pageSlotQuotaSize || '0.75rem', color: 'var(--color-danger-light)', fontWeight: 600 }}>เต็มแล้ว</div>
                              ) : isClosed ? (
                                <div style={{ fontSize: pageSlotQuotaSize || '0.75rem', color: 'var(--color-text-muted)' }}>ปิด</div>
                              ) : (
                                <div
                                  className="slot-available"
                                  style={{
                                    fontSize: pageSlotQuotaSize,
                                    color: pageSlotQuotaColor,
                                  }}
                                >
                                  ว่าง {available}/{slot.capacity} {slotUnit}
                                </div>
                              )}
                            </div>
                          )
                        }
                        return null
                      })}
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
                      <label
                        className="form-label"
                        style={{
                          color: pageFormLabelColor,
                          fontWeight: pageFormLabelWeight,
                        }}
                      >
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
                  <><div className="spinner" /> กำลังบันทึก...</>
                ) : (
                  <>📋 ลงทะเบียน/จองคิว</>
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
    </div>
  )
}
