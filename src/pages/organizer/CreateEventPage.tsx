import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import type { CustomField } from '../../lib/database.types'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import './CreateEventPage.css'

interface SlotInput {
  id: string
  slot_date: string
  start_time: string
  end_time: string
  capacity: number
}

interface FieldInput {
  id: string
  label: string
  field_type: CustomField['field_type']
  is_required: boolean
  options: string[]
}

const DEFAULT_FIELDS: FieldInput[] = [
  { id: uuidv4(), label: 'ชื่อ-นามสกุล', field_type: 'text', is_required: true, options: [] },
  { id: uuidv4(), label: 'เบอร์โทรศัพท์มือถือ', field_type: 'phone', is_required: true, options: [] },
]

function TimePicker({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [hour, min] = value.split(':')
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
  const mins = ['00', '15', '30', '45']
  
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      <select className="form-input form-select" style={{ paddingRight: '24px' }} value={hour || '09'} onChange={e => onChange(`${e.target.value}:${min || '00'}`)}>
        {hours.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span style={{ alignSelf: 'center' }}>:</span>
      <select className="form-input form-select" style={{ paddingRight: '24px' }} value={min || '00'} onChange={e => onChange(`${hour || '09'}:${e.target.value}`)}>
        {mins.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  )
}

export default function CreateEventPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialIsGroup = searchParams.get('group') === 'true'
  const parentId = searchParams.get('parent_id') || null

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string>('')

  // Event info
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [queuePrefix, setQueuePrefix] = useState('')
  const [ttsPhrase, setTtsPhrase] = useState('ขอเชิญหมายเลข')
  const [ttsCallName, setTtsCallName] = useState(true)
  const [ttsVoiceGender, setTtsVoiceGender] = useState<'female' | 'male'>('female')
  const [ttsUseEnding, setTtsUseEnding] = useState(true)
  const [ttsEndingWord, setTtsEndingWord] = useState('ค่ะ')
  const [queueType, setQueueType] = useState<'unlimited' | 'scheduled' | 'group'>(initialIsGroup ? 'group' : 'unlimited')
  const [queueNumberingType, setQueueNumberingType] = useState<'normal' | 'round_reset' | 'round_fixed'>('normal')
  const isGroup = queueType === 'group'

  const [slots, setSlots] = useState<SlotInput[]>([
    { id: uuidv4(), slot_date: '', start_time: '09:00', end_time: '10:00', capacity: 10 }
  ])

  // Custom fields
  const [fields, setFields] = useState<FieldInput[]>(DEFAULT_FIELDS)

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBannerFile(file)
    setBannerPreview(URL.createObjectURL(file))
  }

  const addSlot = () => {
    setSlots(prev => [...prev, { id: uuidv4(), slot_date: '', start_time: '09:00', end_time: '10:00', capacity: 10 }])
  }

  const updateSlot = (id: string, key: keyof SlotInput, value: string | number) => {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, [key]: value } : s))
  }

  const removeSlot = (id: string) => {
    setSlots(prev => prev.filter(s => s.id !== id))
  }

  const addField = () => {
    setFields(prev => [...prev, { id: uuidv4(), label: '', field_type: 'text', is_required: false, options: [] }])
  }

  const updateField = (id: string, key: keyof FieldInput, value: unknown) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, [key]: value } : f))
  }

  const removeField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id))
  }

  const handleSubmit = async () => {
    if (!user) return
    if (!title.trim()) { toast.error('กรุณาใส่ชื่อกิจกรรม'); return }
    if (queueType === 'scheduled' && slots.some(s => !s.slot_date)) {
      toast.error('กรุณาระบุวันที่ในทุกรอบ')
      return
    }

    setLoading(true)
    try {
      // Upload banner if any
      let bannerUrl: string | null = null
      if (bannerFile) {
        const ext = bannerFile.name.split('.').pop()
        const filename = `${user.id}/${uuidv4()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('event-banners')
          .upload(filename, bannerFile, { upsert: true })
        if (uploadError) throw new Error('Banner upload: ' + uploadError.message)
        const { data: { publicUrl } } = supabase.storage.from('event-banners').getPublicUrl(filename)
        bannerUrl = publicUrl
      }

      // Create event
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          organizer_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          banner_url: bannerUrl,
          queue_type: isGroup ? 'unlimited' : queueType,
          is_group: isGroup,
          parent_id: parentId,
          status: 'active',
          settings: isGroup ? {} : { 
            queue_prefix: queuePrefix.trim(),
            queue_numbering_type: queueNumberingType,
            tts_phrase: ttsPhrase.trim() || 'ขอเชิญหมายเลข',
            tts_call_name: ttsCallName,
            tts_voice_gender: ttsVoiceGender,
            tts_use_ending: ttsUseEnding,
            tts_ending_word: ttsEndingWord.trim()
          },
        })
        .select()
        .single()

      if (eventError) throw new Error('events: ' + eventError.message)

      if (!isGroup) {
        // Create slots if scheduled
        if (queueType === 'scheduled' && slots.length > 0) {
          const { error: slotsError } = await supabase.from('event_slots').insert(
            slots.map(s => ({
              event_id: event.id,
              slot_date: s.slot_date,
              start_time: s.start_time,
              end_time: s.end_time,
              capacity: s.capacity,
              booked_count: 0
            }))
          )
          if (slotsError) throw new Error('event_slots: ' + slotsError.message)
        }

        // Create custom fields
        const customFields = fields.filter(f => f.label.trim() !== '')
        if (customFields.length > 0) {
          const { error: fieldsError } = await supabase.from('custom_fields').insert(
            customFields.map((f, idx) => ({
              event_id: event.id,
              label: f.label.trim(),
              field_type: f.field_type,
              is_required: f.is_required,
              options: f.options,
              sort_order: idx,
            }))
          )
          if (fieldsError) throw new Error('custom_fields: ' + fieldsError.message)
        }

        // Create queue session
        const { error: qsError } = await supabase.from('queue_sessions').insert({
          event_id: event.id,
          current_numbers: [],
          call_count_per_round: 1,
          show_name: true,
          language: 'th',
        })
        if (qsError) throw new Error('queue_sessions: ' + qsError.message)
      }

      toast.success(isGroup ? 'สร้างงานสำเร็จ!' : 'สร้างกิจกรรมสำเร็จ!')
      if (parentId) {
        navigate(`/organizer/events/${parentId}`)
      } else {
        navigate(`/organizer/events/${event.id}`)
      }
    } catch (err: any) {
      console.error(err)
      toast.error('เกิดข้อผิดพลาด: ' + (err.message || 'ไม่สามารถสร้างกิจกรรมได้'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-event-page fade-in">
      <div className="create-event-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/organizer')}>
          ← กลับ
        </button>
        <h1>{isGroup ? 'สร้างแฟ้มรวมกิจกรรม' : parentId ? 'สร้างกิจกรรมย่อย' : 'สร้างกิจกรรมใหม่'}</h1>
      </div>

      {/* Step indicator */}
      {initialIsGroup && (
        <div className="steps">
          {['ข้อมูลงาน', 'ยืนยัน'].map((label, idx) => {
            const mappedStep = idx === 0 ? 1 : 4
            return (
              <div key={idx} className={`step ${step > mappedStep ? 'done' : ''} ${step === mappedStep ? 'active' : ''}`}>
                <div className="step-circle">{step > mappedStep ? '✓' : idx + 1}</div>
                <div className="step-label">{label}</div>
              </div>
            )
          })}
        </div>
      )}
      {!initialIsGroup && (
        <div className="steps">
          {['ข้อมูลกิจกรรม', 'รูปแบบคิว', 'คำถามการจอง', 'ยืนยัน'].map((label, idx) => {
            const isSkipped = isGroup && idx === 2;
            return (
              <div key={idx} className={`step ${step > idx + 1 ? 'done' : ''} ${step === idx + 1 ? 'active' : ''} ${isSkipped ? 'skipped' : ''}`}>
                <div className="step-circle">{step > idx + 1 || isSkipped ? '✓' : idx + 1}</div>
                <div className="step-label" style={{ opacity: isSkipped ? 0.5 : 1 }}>{label}</div>
              </div>
            )
          })}
        </div>
      )}

      <div className="create-event-body">
        {/* Step 1: Event info */}
        {step === 1 && (
          <div className="create-step fade-in">
            <div className="glass-card" style={{ padding: 'var(--space-8)' }}>
              <h2>ข้อมูลกิจกรรม</h2>
              <div className="create-form">
                <div className="form-group">
                  <label className="form-label">{isGroup ? 'ชื่องาน' : 'ชื่อกิจกรรม'} <span className="required">*</span></label>
                  <input
                    className="form-input"
                    placeholder="เช่น บริการตัดผมประจำเดือน กรกฎาคม"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                  <div className="quick-titles">
                    {['บริการตัดผม', 'บริการทำเล็บ', 'ตรวจสุขภาพประจำปี', 'บริการนวดไทย'].map(t => (
                      <button key={t} className="quick-title-btn" onClick={() => setTitle(t)}>{t}</button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">รายละเอียด</label>
                  <textarea
                    className="form-input form-textarea"
                    placeholder="รายละเอียดเพิ่มเติม เช่น สถานที่ เงื่อนไขการใช้บริการ..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>

                {!isGroup && (
                  <>
                    <div className="form-group">
                      <label className="form-label">ตัวอักษรนำหน้าคิว (Queue Prefix)</label>
                      <input
                        className="form-input"
                        placeholder="เช่น A, B, C (เว้นว่างไว้หากไม่ต้องการ)"
                        maxLength={2}
                        value={queuePrefix}
                        onChange={e => setQueuePrefix(e.target.value.toUpperCase())}
                      />
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        ตัวอย่างคิวที่จะได้: {queuePrefix ? queuePrefix : ''}001, {queuePrefix ? queuePrefix : ''}002
                      </div>
                    </div>

                    {queueType === 'scheduled' && (
                      <div className="form-group">
                        <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>รูปแบบการจัดคิว (Queue Numbering Style)</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.875rem' }}>
                            <input
                              type="radio"
                              name="queue_numbering_type"
                              value="normal"
                              checked={queueNumberingType === 'normal'}
                              onChange={() => setQueueNumberingType('normal')}
                              style={{ marginTop: '3px' }}
                            />
                            <div>
                              <strong style={{ color: 'var(--color-text-primary)' }}>1. แบบปกติ:</strong> <span style={{ color: 'var(--color-text-secondary)' }}>เลขคิวจะรันต่อเนื่องไปเรื่อยๆ ทุกรอบเวลา (เช่น {queuePrefix || ''}001, {queuePrefix || ''}002, {queuePrefix || ''}003, ...)</span>
                            </div>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.875rem' }}>
                            <input
                              type="radio"
                              name="queue_numbering_type"
                              value="round_reset"
                              checked={queueNumberingType === 'round_reset'}
                              onChange={() => setQueueNumberingType('round_reset')}
                              style={{ marginTop: '3px' }}
                            />
                            <div>
                              <strong style={{ color: 'var(--color-text-primary)' }}>2. แบบลำดับตามรอบ:</strong> <span style={{ color: 'var(--color-text-secondary)' }}>เลขคิวจะเริ่มต้นใหม่ที่ 1 ในทุกๆ รอบเวลา (เช่น รอบแรก: {queuePrefix || ''}001-{queuePrefix || ''}007, รอบถัดไป: {queuePrefix || ''}001-{queuePrefix || ''}007) และระบุรอบในตั๋ว</span>
                            </div>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.875rem' }}>
                            <input
                              type="radio"
                              name="queue_numbering_type"
                              value="round_fixed"
                              checked={queueNumberingType === 'round_fixed'}
                              onChange={() => setQueueNumberingType('round_fixed')}
                              style={{ marginTop: '3px' }}
                            />
                            <div>
                              <strong style={{ color: 'var(--color-text-primary)' }}>3. แบบฟิกเลขตามรอบ:</strong> <span style={{ color: 'var(--color-text-secondary)' }}>เลขคิวจะรันตามโควตาความจุสะสมของแต่ละรอบเวลา (เช่น รอบแรก (รับ 7 คน): {queuePrefix || ''}001-{queuePrefix || ''}007, รอบสอง (รับ 7 คน): {queuePrefix || ''}008-{queuePrefix || ''}014 โดยเรียงตามโควตารอบจอง)</span>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">คำพูดเรียกคิว (TTS Phrase)</label>
                      <input
                        className="form-input"
                        placeholder="เช่น ขอเชิญหมายเลข, ขอเรียกคิวที่"
                        value={ttsPhrase}
                        onChange={e => setTtsPhrase(e.target.value)}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '0.875rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={ttsCallName} 
                          onChange={e => setTtsCallName(e.target.checked)} 
                        />
                        เรียกชื่อผู้จองต่อท้ายหมายเลขคิว (ถ้ามี)
                      </label>
                    </div>

                    <div className="form-group">
                      <label className="form-label">เสียงเรียกและคำลงท้าย (TTS Voice)</label>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        <select 
                          className="form-input form-select" 
                          style={{ flex: 1, minWidth: '150px' }}
                          value={ttsVoiceGender}
                          onChange={e => {
                            const gender = e.target.value as 'female' | 'male'
                            setTtsVoiceGender(gender)
                            if (ttsEndingWord === 'ค่ะ' || ttsEndingWord === 'ครับ') {
                              setTtsEndingWord(gender === 'female' ? 'ค่ะ' : 'ครับ')
                            }
                          }}
                        >
                          <option value="female">เสียงผู้หญิง</option>
                          <option value="male">เสียงผู้ชาย</option>
                        </select>
                      </div>
                      
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', cursor: 'pointer', marginBottom: '8px' }}>
                        <input 
                          type="checkbox" 
                          checked={ttsUseEnding} 
                          onChange={e => setTtsUseEnding(e.target.checked)} 
                        />
                        พูดคำลงท้าย (เช่น ค่ะ/ครับ)
                      </label>
                      
                      {ttsUseEnding && (
                        <input
                          className="form-input"
                          placeholder="ระบุคำลงท้ายที่ต้องการ เช่น ค่ะ, ครับ, เจ้า"
                          value={ttsEndingWord}
                          onChange={e => setTtsEndingWord(e.target.value)}
                        />
                      )}
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">แบนเนอร์กิจกรรม</label>
                  <div className="banner-upload">
                    {bannerPreview ? (
                      <div className="banner-preview">
                        <img src={bannerPreview} alt="banner" />
                        <button className="btn btn-danger btn-sm banner-remove" onClick={() => { setBannerFile(null); setBannerPreview('') }}>
                          ✕ ลบรูป
                        </button>
                      </div>
                    ) : (
                      <label className="banner-dropzone">
                        <input type="file" accept="image/*" onChange={handleBannerChange} style={{ display: 'none' }} />
                        <div className="banner-dropzone-content">
                          <span style={{ fontSize: '2rem' }}>🖼️</span>
                          <span>คลิกเพื่ออัปโหลดรูปแบนเนอร์</span>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>PNG, JPG ขนาดสูงสุด 5MB</span>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Queue type */}
        {step === 2 && (
          <div className="create-step fade-in">
            <div className="glass-card" style={{ padding: 'var(--space-8)' }}>
              <h2>รูปแบบการจองคิว</h2>
              <div className="queue-type-options">
                <div
                  className={`queue-type-card ${queueType === 'unlimited' ? 'selected' : ''}`}
                  onClick={() => setQueueType('unlimited')}
                >
                  <div className="queue-type-icon">♾️</div>
                  <div className="queue-type-title">ไม่จำกัดจำนวน (Unlimited)</div>
                  <div className="queue-type-desc">รันคิวต่อไปเรื่อยๆ ผู้จองจะได้รับหมายเลขคิวตามลำดับ ไม่มีช่วงเวลา</div>
                  {queueType === 'unlimited' && <div className="queue-type-check">✓</div>}
                </div>
                <div
                  className={`queue-type-card ${queueType === 'scheduled' ? 'selected' : ''}`}
                  onClick={() => setQueueType('scheduled')}
                >
                  <div className="queue-type-icon">⏰</div>
                  <div className="queue-type-title">กำหนดรอบเวลา (Scheduled)</div>
                  <div className="queue-type-desc">กำหนดช่วงเวลาและจำนวนที่รับต่อรอบ เหมือนจองตั๋วหนัง</div>
                  {queueType === 'scheduled' && <div className="queue-type-check">✓</div>}
                </div>
                {!parentId && (
                  <div
                    className={`queue-type-card ${queueType === 'group' ? 'selected' : ''}`}
                    onClick={() => setQueueType('group')}
                  >
                    <div className="queue-type-icon">📁</div>
                    <div className="queue-type-title">แฟ้มรวมหลายกิจกรรม (Group)</div>
                    <div className="queue-type-desc">สร้างเป็นงานใหญ่ก่อน แล้วค่อยไปเพิ่มกิจกรรมย่อยต่างๆ ทีหลังได้</div>
                    {queueType === 'group' && <div className="queue-type-check">✓</div>}
                  </div>
                )}
              </div>

              {queueType === 'scheduled' && (
                <div className="slots-section fade-in">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                    <h3>กำหนดรอบเวลา</h3>
                    <button className="btn btn-secondary btn-sm" onClick={addSlot}>+ เพิ่มรอบ</button>
                  </div>
                  {slots.map((slot, idx) => (
                    <div key={slot.id} className="slot-input-row">
                      <span className="slot-number">รอบ {idx + 1}</span>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">วันที่</label>
                        <input 
                          type="date" 
                          className="form-input" 
                          value={slot.slot_date} 
                          onChange={e => updateSlot(slot.id, 'slot_date', e.target.value)} 
                          onClick={e => { try { e.currentTarget.showPicker() } catch (err) {} }} 
                        />
                      </div>
                      <div className="form-group" style={{ width: '130px' }}>
                        <label className="form-label">เริ่ม</label>
                        <TimePicker value={slot.start_time} onChange={v => updateSlot(slot.id, 'start_time', v)} />
                      </div>
                      <div className="form-group" style={{ width: '130px' }}>
                        <label className="form-label">สิ้นสุด</label>
                        <TimePicker value={slot.end_time} onChange={v => updateSlot(slot.id, 'end_time', v)} />
                      </div>
                      <div className="form-group" style={{ width: '90px' }}>
                        <label className="form-label">รับ (คน)</label>
                        <input type="number" className="form-input" min={1} value={slot.capacity} onChange={e => updateSlot(slot.id, 'capacity', parseInt(e.target.value))} />
                      </div>
                      {slots.length > 1 && (
                        <button className="btn btn-danger btn-sm" style={{ marginTop: '24px' }} onClick={() => removeSlot(slot.id)}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Custom fields */}
        {step === 3 && (
          <div className="create-step fade-in">
            <div className="glass-card" style={{ padding: 'var(--space-8)' }}>
              <h2>คำถามสำหรับการจอง</h2>
              <p style={{ marginBottom: 'var(--space-6)' }}>ระบุข้อมูลที่ต้องการเก็บจากผู้จอง</p>
              <div className="fields-list">
                {fields.map((field, idx) => (
                  <div key={field.id} className="field-row">
                    <div className="field-row-num">{idx + 1}</div>
                    <div className="field-row-inputs">
                      <input
                        className="form-input"
                        placeholder="คำถาม เช่น ชื่อ-นามสกุล"
                        value={field.label}
                        onChange={e => updateField(field.id, 'label', e.target.value)}
                      />
                      <select
                        className="form-input form-select"
                        value={field.field_type}
                        onChange={e => updateField(field.id, 'field_type', e.target.value)}
                        style={{ maxWidth: '150px' }}
                      >
                        <option value="text">ข้อความ</option>
                        <option value="phone">เบอร์โทร</option>
                        <option value="email">อีเมล</option>
                        <option value="number">ตัวเลข</option>
                        <option value="select">เลือกตัวเลือก</option>
                      </select>
                      <label className="checkbox-wrapper">
                        <input
                          type="checkbox"
                          checked={field.is_required}
                          onChange={e => updateField(field.id, 'is_required', e.target.checked)}
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>จำเป็น</span>
                      </label>
                    </div>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeField(field.id)}>✕</button>
                  </div>
                ))}
              </div>
              <button className="btn btn-secondary" style={{ marginTop: 'var(--space-4)' }} onClick={addField}>
                + เพิ่มคำถาม
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div className="create-step fade-in">
            <div className="glass-card" style={{ padding: 'var(--space-8)' }}>
              <h2>ยืนยันข้อมูล</h2>
              <div className="confirm-section">
                <div className="confirm-item">
                  <span className="confirm-label">{isGroup ? 'ชื่องาน' : 'ชื่อกิจกรรม'}</span>
                  <span className="confirm-value">{title}</span>
                </div>
                {!isGroup && (
                  <>
                    <div className="confirm-item">
                      <span className="confirm-label">รูปแบบคิว</span>
                      <span className="confirm-value">{queueType === 'unlimited' ? '♾️ ไม่จำกัดจำนวน' : `⏰ กำหนดรอบ (${slots.length} รอบ)`}</span>
                    </div>
                    <div className="confirm-item">
                      <span className="confirm-label">คำถาม</span>
                      <span className="confirm-value">{fields.filter(f => f.label).length} ข้อ</span>
                    </div>
                  </>
                )}
              </div>
              <p style={{ marginTop: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                {isGroup ? 'หลังจากสร้างแล้ว คุณสามารถเพิ่มกิจกรรมย่อยเข้าไปในงานนี้ได้ในหน้าจัดการงาน' : 'หลังจากสร้างแล้ว คุณสามารถแก้ไขรายละเอียดได้ในหน้าจัดการกิจกรรม'}
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="create-nav">
          {step > 1 && (
            <button className="btn btn-ghost" onClick={() => {
              if (isGroup && step === 4) {
                setStep(2)
              } else {
                setStep(s => s - 1)
              }
            }}>← ย้อนกลับ</button>
          )}
          <div style={{ flex: 1 }} />
          {step < 4 ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                if (step === 1 && !title.trim()) { toast.error(isGroup ? 'กรุณาใส่ชื่องาน' : 'กรุณาใส่ชื่อกิจกรรม'); return }
                if (isGroup && (step === 1 || step === 2)) {
                  setStep(4)
                } else {
                  setStep(s => s + 1)
                }
              }}
            >
              ถัดไป →
            </button>
          ) : (
            <button
              className="btn btn-primary btn-lg"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <><div className="spinner" /> กำลังสร้าง...</> : isGroup ? '🎉 สร้างงาน' : '🎉 สร้างกิจกรรม'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
