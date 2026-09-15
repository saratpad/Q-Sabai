import React, { useState, useRef } from 'react'
import type { TicketSettings } from './ticketTypes'
import { 
  DEFAULT_TICKET_SETTINGS, 
  PRESET_BG_COLORS, 
  PRESET_NUMBER_COLORS 
} from './ticketTypes'
import { TicketCard } from './TicketCard'
import { supabase } from '../../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import toast from 'react-hot-toast'
import './TicketCustomizer.css'

export interface TicketCustomizerProps {
  settings: TicketSettings
  onChange: (settings: TicketSettings) => void
  userId?: string
  eventTitle?: string
  queuePrefix?: string
}

export const TicketCustomizer: React.FC<TicketCustomizerProps> = ({
  settings,
  onChange,
  userId,
  eventTitle = 'กิจกรรมตัวอย่าง',
  queuePrefix = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // Merge with default settings
  const mergedSettings: Required<TicketSettings> = {
    ...DEFAULT_TICKET_SETTINGS,
    ...settings,
  }

  const updateSetting = <K extends keyof TicketSettings>(key: K, value: TicketSettings[K]) => {
    onChange({
      ...mergedSettings,
      [key]: value,
    })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5 MB')
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const folder = userId || 'public'
      const filename = `${folder}/ticket_bg_${uuidv4()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('event-banners')
        .upload(filename, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('event-banners')
        .getPublicUrl(filename)

      updateSetting('ticket_bg_image', publicUrl)
      updateSetting('ticket_bg_type', 'image')
      toast.success('อัปโหลดภาพพื้นหลังสำเร็จ')
    } catch (err: any) {
      console.error(err)
      toast.error('อัปโหลดภาพไม่สำเร็จ: ' + (err.message || ''))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="ticket-customizer">
      {/* Enable / Disable Ticket Mode Toggle */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'var(--color-bg-card)',
          padding: 'var(--space-4) var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-text-primary)' }}>
            🎫 เปิดใช้งานตั๋วคิว (Ticket Mode)
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {mergedSettings.ticket_enabled 
              ? 'เปิดใช้งานตั๋วคิวแบบตกแต่ง (สามารถปรับแต่งสี พื้นหลัง ขนาดฟอนต์ และดาวน์โหลดภาพตั๋วได้)' 
              : 'ปิดใช้งานตั๋วคิว — ผู้จองจะได้รับ "รูปแบบจองคิวธรรมดา" (ใบคิวมาตรฐาน เรียบง่าย ไม่ดาวน์โหลดภาพตั๋ว)'}
          </div>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={mergedSettings.ticket_enabled}
            onChange={e => updateSetting('ticket_enabled', e.target.checked)}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      <div className="ticket-customizer-grid">
        {/* Controls Column */}
        <div className="ticket-controls">
          {mergedSettings.ticket_enabled ? (
            <>
              {/* Background Type (Color vs Image) */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>รูปแบบพื้นหลังตั๋ว</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    className={`font-size-btn ${mergedSettings.ticket_bg_type === 'color' ? 'active' : ''}`}
                    onClick={() => updateSetting('ticket_bg_type', 'color')}
                  >
                    🎨 สีพื้นหลัง
                  </button>
                  <button
                    type="button"
                    className={`font-size-btn ${mergedSettings.ticket_bg_type === 'image' ? 'active' : ''}`}
                    onClick={() => updateSetting('ticket_bg_type', 'image')}
                  >
                    🖼️ ภาพพื้นหลัง
                  </button>
                </div>
              </div>

              {/* Background Color Settings */}
              {mergedSettings.ticket_bg_type === 'color' && (
                <div className="form-group fade-in">
                  <label className="form-label">เลือกสีพื้นหลัง</label>
                  <div className="color-input-wrapper">
                    <div 
                      className="color-input-preview" 
                      style={{ backgroundColor: mergedSettings.ticket_bg_color }}
                    >
                      <input
                        type="color"
                        value={mergedSettings.ticket_bg_color}
                        onChange={e => updateSetting('ticket_bg_color', e.target.value)}
                      />
                    </div>
                    <input
                      type="text"
                      className="form-input"
                      value={mergedSettings.ticket_bg_color}
                      onChange={e => updateSetting('ticket_bg_color', e.target.value)}
                      placeholder="#111827"
                      style={{ maxWidth: '140px', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                  {/* Preset Colors */}
                  <div className="preset-swatches">
                    {PRESET_BG_COLORS.map(p => (
                      <button
                        key={p.color}
                        type="button"
                        className={`preset-swatch-btn ${mergedSettings.ticket_bg_color.toLowerCase() === p.color.toLowerCase() ? 'active' : ''}`}
                        style={{ backgroundColor: p.color }}
                        title={p.name}
                        onClick={() => updateSetting('ticket_bg_color', p.color)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Background Image Settings */}
              {mergedSettings.ticket_bg_type === 'image' && (
                <div className="form-group fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label className="form-label">อัปโหลดภาพพื้นหลัง</label>
                  {mergedSettings.ticket_bg_image ? (
                    <div className="ticket-bg-preview-wrapper">
                      <img src={mergedSettings.ticket_bg_image} alt="Ticket background" className="ticket-bg-preview-img" />
                      <button
                        type="button"
                        className="ticket-bg-remove-btn"
                        title="ลบรูปภาพ"
                        onClick={() => updateSetting('ticket_bg_image', null)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div 
                      className="ticket-bg-upload-zone"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <div className="spinner" /> กำลังอัปโหลด...
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>📁</div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>คลิกเพื่อเลือกภาพพื้นหลัง</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>รองรับ JPG, PNG, WEBP (ไม่เกิน 5 MB)</div>
                        </>
                      )}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageUpload}
                  />

                  {/* Or enter image URL directly */}
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>หรือระบุ URL รูปภาพ</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="https://example.com/image.jpg"
                      value={mergedSettings.ticket_bg_image || ''}
                      onChange={e => updateSetting('ticket_bg_image', e.target.value.trim() || null)}
                    />
                  </div>

                  {/* Background Overlay Slider */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                      <label className="form-label" style={{ margin: 0 }}>ความมืดของเลเยอร์ทับภาพ (Overlay)</label>
                      <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{mergedSettings.ticket_bg_overlay ?? 40}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      value={mergedSettings.ticket_bg_overlay ?? 40}
                      onChange={e => updateSetting('ticket_bg_overlay', parseInt(e.target.value))}
                      style={{ width: '100%' }}
                    />
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      * ช่วยให้อ่านตัวหนังสือและเลขคิวบนภาพพื้นหลังได้คมชัดเสมอ
                    </div>
                  </div>
                </div>
              )}

              {/* Text Color & Number Color */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">สีตัวอักษรทั่วไป</label>
                  <div className="color-input-wrapper">
                    <div 
                      className="color-input-preview" 
                      style={{ backgroundColor: mergedSettings.ticket_text_color }}
                    >
                      <input
                        type="color"
                        value={mergedSettings.ticket_text_color}
                        onChange={e => updateSetting('ticket_text_color', e.target.value)}
                      />
                    </div>
                    <input
                      type="text"
                      className="form-input"
                      value={mergedSettings.ticket_text_color}
                      onChange={e => updateSetting('ticket_text_color', e.target.value)}
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">สีหมายเลขคิว</label>
                  <div className="color-input-wrapper">
                    <div 
                      className="color-input-preview" 
                      style={{ backgroundColor: mergedSettings.ticket_number_color }}
                    >
                      <input
                        type="color"
                        value={mergedSettings.ticket_number_color}
                        onChange={e => updateSetting('ticket_number_color', e.target.value)}
                      />
                    </div>
                    <input
                      type="text"
                      className="form-input"
                      value={mergedSettings.ticket_number_color}
                      onChange={e => updateSetting('ticket_number_color', e.target.value)}
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                  <div className="preset-swatches">
                    {PRESET_NUMBER_COLORS.map(p => (
                      <button
                        key={p.color}
                        type="button"
                        className={`preset-swatch-btn ${mergedSettings.ticket_number_color.toLowerCase() === p.color.toLowerCase() ? 'active' : ''}`}
                        style={{ backgroundColor: p.color }}
                        title={p.name}
                        onClick={() => updateSetting('ticket_number_color', p.color)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Font Size Scale */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>ขนาดตัวอักษร (Font Size)</label>
                <div className="font-size-options">
                  {(['small', 'medium', 'large', 'xlarge'] as const).map(size => {
                    const labels = {
                      small: 'เล็ก (S)',
                      medium: 'ปกติ (M)',
                      large: 'ใหญ่ (L)',
                      xlarge: 'ใหญ่มาก (XL)',
                    }
                    return (
                      <button
                        key={size}
                        type="button"
                        className={`font-size-btn ${mergedSettings.ticket_font_size === size ? 'active' : ''}`}
                        onClick={() => updateSetting('ticket_font_size', size)}
                      >
                        {labels[size]}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: 'var(--space-4) 0', color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--color-primary)', fontWeight: 600 }}>
                ℹ️ กำลังใช้งาน: รูปแบบจองคิวธรรมดา (Normal Queue Mode)
              </div>
              <p style={{ margin: '0 0 12px 0' }}>
                เมื่อปิดตั๋วคิว ผู้ใช้ที่จองคิวจะได้รับการ์ดแสดงหมายเลขคิวแบบมาตรฐาน เรียบง่าย ชัดเจน และระบบจะ<strong>ไม่ดาวน์โหลดรูปตั๋วเป็นภาพอัตโนมัติ</strong>
              </p>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                เหมาะสำหรับงานบริการที่ต้องการความรวดเร็ว คล่องตัว หรือต้องการใบคิวแบบเรียบง่าย เช่น ธนาคาร โรงพยาบาล หรือหน่วยงานราชการ
              </p>
            </div>
          )}
        </div>

        {/* Live Preview Column */}
        <div className="ticket-preview-box">
          <div className="ticket-preview-title">
            <span>👁️ ตัวอย่างผลลัพธ์ (Live Preview)</span>
          </div>

          <TicketCard
            settings={mergedSettings}
            queueNumber={`${queuePrefix || ''}001`}
            eventTitle={eventTitle || 'ชื่องาน / กิจกรรมของคุณ'}
            slotInfo="รอบ: 09:00 - 10:00 น."
            dateStr="15 กันยายน 2569 09:30 น."
            isInteractivePreview={true}
          />
        </div>
      </div>
    </div>
  )
}
