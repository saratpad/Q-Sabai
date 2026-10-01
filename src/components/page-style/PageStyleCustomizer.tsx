import React, { useState, useRef } from 'react'
import type { PageStyleSettings, SlotCardItemKey } from '../ticket/ticketTypes'
import {
  DEFAULT_PAGE_STYLE_SETTINGS,
  PAGE_TITLE_SIZES,
  PAGE_DESC_SIZES,
  PAGE_SLOT_HEADER_SIZES,
  PAGE_SLOT_TIME_SIZES,
  PAGE_SLOT_DATE_SIZES,
  PAGE_SLOT_QUOTA_SIZES,
  PAGE_SLOT_CARD_SIZES,
  PRESET_TEXT_COLORS,
  PRESET_PAGE_BG_COLORS,
  PRESET_SLOT_UNITS,
} from '../ticket/ticketTypes'
import { FormattedText } from '../common/FormattedText'
import { supabase } from '../../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import toast from 'react-hot-toast'
import './PageStyleCustomizer.css'

export interface PageStyleCustomizerProps {
  settings: PageStyleSettings
  onChange: (settings: PageStyleSettings) => void
  userId?: string
  eventTitle?: string
  eventDesc?: string
}

export const PageStyleCustomizer: React.FC<PageStyleCustomizerProps> = ({
  settings,
  onChange,
  userId,
  eventTitle = 'ชื่องานกิจกรรมตัวอย่าง',
  eventDesc = 'รายละเอียดกิจกรรมสำหรับการจองคิว เช่น เวลา สถานที่ หรือเงื่อนไขต่างๆ',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const defaultSlotHeaderColor = (settings.page_card_theme || DEFAULT_PAGE_STYLE_SETTINGS.page_card_theme) === 'light' ? '#1e293b' : '#f1f5f9'
  const defaultSlotTimeColor = (settings.page_card_theme || DEFAULT_PAGE_STYLE_SETTINGS.page_card_theme) === 'light' ? '#1e293b' : '#f1f5f9'

  // Merge with default settings
  const mergedSettings: Required<PageStyleSettings> = {
    ...DEFAULT_PAGE_STYLE_SETTINGS,
    page_slot_header_color: defaultSlotHeaderColor,
    page_slot_time_color: defaultSlotTimeColor,
    ...settings,
  }

  const updateSetting = <K extends keyof PageStyleSettings>(
    key: K,
    value: PageStyleSettings[K]
  ) => {
    onChange({
      ...mergedSettings,
      [key]: value,
    })
  }

  const handleThemeChange = (newTheme: 'glass' | 'solid' | 'light') => {
    const isNewLight = newTheme === 'light'
    const isOldLight = mergedSettings.page_card_theme === 'light'

    let newHeaderColor = mergedSettings.page_slot_header_color
    let newTimeColor = mergedSettings.page_slot_time_color
    let newTitleColor = mergedSettings.page_title_color
    let newDescColor = mergedSettings.page_desc_color
    let newDateColor = mergedSettings.page_slot_date_color

    if (isNewLight && !isOldLight) {
      if (newHeaderColor === '#f1f5f9' || newHeaderColor === '#ffffff') newHeaderColor = '#1e293b'
      if (newTimeColor === '#f1f5f9' || newTimeColor === '#ffffff') newTimeColor = '#1e293b'
      if (newTitleColor === '#f1f5f9' || newTitleColor === '#ffffff') newTitleColor = '#0f172a'
      if (newDescColor === '#94a3b8') newDescColor = '#475569'
      if (newDateColor === '#94a3b8') newDateColor = '#475569'
    } else if (!isNewLight && isOldLight) {
      if (newHeaderColor === '#1e293b' || newHeaderColor === '#0f172a' || newHeaderColor === '#000000') newHeaderColor = '#f1f5f9'
      if (newTimeColor === '#1e293b' || newTimeColor === '#0f172a' || newTimeColor === '#000000') newTimeColor = '#f1f5f9'
      if (newTitleColor === '#1e293b' || newTitleColor === '#0f172a' || newTitleColor === '#000000') newTitleColor = '#f1f5f9'
      if (newDescColor === '#475569') newDescColor = '#94a3b8'
      if (newDateColor === '#475569') newDateColor = '#94a3b8'
    }

    onChange({
      ...mergedSettings,
      page_card_theme: newTheme,
      page_slot_header_color: newHeaderColor,
      page_slot_time_color: newTimeColor,
      page_title_color: newTitleColor,
      page_desc_color: newDescColor,
      page_slot_date_color: newDateColor,
    })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5 MB')
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const folder = userId || 'public'
      const filename = `${folder}/page_bg_${uuidv4()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('event-banners')
        .upload(filename, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('event-banners')
        .getPublicUrl(filename)

      updateSetting('page_bg_image', publicUrl)
      updateSetting('page_bg_type', 'image')
      toast.success('อัปโหลดภาพพื้นหลังหน้าจองสำเร็จ')
    } catch (err: any) {
      console.error(err)
      toast.error('อัปโหลดภาพไม่สำเร็จ: ' + (err.message || ''))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const titleSizeInfo = PAGE_TITLE_SIZES[mergedSettings.page_title_size] || PAGE_TITLE_SIZES.medium
  const descSizeInfo = PAGE_DESC_SIZES[mergedSettings.page_desc_size] || PAGE_DESC_SIZES.medium
  const slotHeaderSizeInfo = PAGE_SLOT_HEADER_SIZES[mergedSettings.page_slot_header_size] || PAGE_SLOT_HEADER_SIZES.medium
  const slotTimeSizeInfo = PAGE_SLOT_TIME_SIZES[mergedSettings.page_slot_time_size] || PAGE_SLOT_TIME_SIZES.medium
  const slotDateSizeInfo = PAGE_SLOT_DATE_SIZES[mergedSettings.page_slot_date_size] || PAGE_SLOT_DATE_SIZES.small
  const slotQuotaSizeInfo = PAGE_SLOT_QUOTA_SIZES[mergedSettings.page_slot_quota_size] || PAGE_SLOT_QUOTA_SIZES.small
  const slotCardSizeInfo = PAGE_SLOT_CARD_SIZES[mergedSettings.page_slot_card_size] || PAGE_SLOT_CARD_SIZES.medium

  // Compute resolved slot items order
  const currentSlotOrder: SlotCardItemKey[] = (() => {
    const raw = mergedSettings.page_slot_order
    const base: SlotCardItemKey[] = ['time', 'date', 'quota']
    if (!Array.isArray(raw)) return base
    const valid = raw.filter((k): k is SlotCardItemKey => base.includes(k))
    const remaining = base.filter(k => !valid.includes(k))
    return [...valid, ...remaining]
  })()

  const moveSlotItem = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...currentSlotOrder]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newOrder.length) return
    const temp = newOrder[index]
    newOrder[index] = newOrder[targetIndex]
    newOrder[targetIndex] = temp
    updateSetting('page_slot_order', newOrder)
  }

  const setSlotItemPosition = (itemKey: SlotCardItemKey, targetPosition: number) => {
    const filtered = currentSlotOrder.filter(k => k !== itemKey)
    filtered.splice(targetPosition, 0, itemKey)
    updateSetting('page_slot_order', filtered)
  }

  const ITEM_DEFINITIONS: Record<SlotCardItemKey, { title: string; icon: string; previewText: string; desc: string }> = {
    time: {
      title: 'เวลารอบ (Time)',
      icon: '⏰',
      previewText: '09:30 - 12:00',
      desc: 'เวลาเริ่ม - สิ้นสุดของรอบ',
    },
    date: {
      title: 'วันที่ (Date)',
      icon: '📅',
      previewText: `26 ต.ค. ${new Date().getFullYear() + 543}`,
      desc: 'วันของรอบการจอง',
    },
    quota: {
      title: 'จำนวนคงเหลือ (Remaining)',
      icon: '👥',
      previewText: `ว่าง 50/50 ${mergedSettings.slot_unit || 'ที่'}`,
      desc: 'จำนวนที่ว่างหรือสถานะเต็ม',
    },
  }

  const ORDER_PRESETS: { label: string; order: SlotCardItemKey[] }[] = [
    { label: '⏰ เวลา ➔ 📅 วัน ➔ 👥 จำนวนคงเหลือ', order: ['time', 'date', 'quota'] },
    { label: '📅 วัน ➔ ⏰ เวลา ➔ 👥 จำนวนคงเหลือ', order: ['date', 'time', 'quota'] },
    { label: '⏰ เวลา ➔ 👥 จำนวนคงเหลือ ➔ 📅 วัน', order: ['time', 'quota', 'date'] },
    { label: '📅 วัน ➔ 👥 จำนวนคงเหลือ ➔ ⏰ เวลา', order: ['date', 'quota', 'time'] },
    { label: '👥 จำนวนคงเหลือ ➔ ⏰ เวลา ➔ 📅 วัน', order: ['quota', 'time', 'date'] },
  ]

  return (
    <div className="page-style-customizer">
      <div className="page-style-grid">
        {/* Controls Column */}
        <div className="page-style-controls">
          {/* Section 1: Event Title */}
          <div className="page-style-control-group">
            <div className="page-style-section-title">
              <span>🏷️</span>
              <span>หัวข้อกิจกรรม (Event Title)</span>
            </div>

            {/* Title Font Size */}
            <div style={{ marginTop: 'var(--space-2)' }}>
              <label className="page-style-label">
                <span>ขนาดตัวอักษรหัวข้อ</span>
                <span style={{ color: 'var(--color-primary)' }}>{titleSizeInfo.label}</span>
              </label>
              <div className="btn-group-segmented" style={{ marginTop: '6px' }}>
                {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
                  <button
                    key={size}
                    type="button"
                    className={`btn-segmented ${mergedSettings.page_title_size === size ? 'active' : ''}`}
                    onClick={() => updateSetting('page_title_size', size)}
                  >
                    {size === 'small' && 'S (เล็ก)'}
                    {size === 'medium' && 'M (ปกติ)'}
                    {size === 'large' && 'L (ใหญ่)'}
                    {size === 'xlarge' && 'XL (พิเศษ)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Title Color */}
            <div style={{ marginTop: 'var(--space-3)' }}>
              <label className="page-style-label">
                <span>สีตัวอักษรหัวข้อ</span>
                <span className="color-hex-text">{mergedSettings.page_title_color}</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <label className="color-input-preview" style={{ backgroundColor: mergedSettings.page_title_color }}>
                  <input
                    type="color"
                    value={mergedSettings.page_title_color}
                    onChange={e => updateSetting('page_title_color', e.target.value)}
                  />
                </label>
                <div className="preset-swatches" style={{ margin: 0, flex: 1 }}>
                  {PRESET_TEXT_COLORS.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      title={c.name}
                      className={`preset-swatch-btn ${mergedSettings.page_title_color.toLowerCase() === c.color.toLowerCase() ? 'active' : ''}`}
                      style={{ backgroundColor: c.color }}
                      onClick={() => updateSetting('page_title_color', c.color)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Event Description */}
          <div className="page-style-control-group">
            <div className="page-style-section-title">
              <span>📝</span>
              <span>รายละเอียดกิจกรรม (Event Description)</span>
            </div>

            {/* Description Font Size */}
            <div style={{ marginTop: 'var(--space-2)' }}>
              <label className="page-style-label">
                <span>ขนาดตัวอักษรรายละเอียด</span>
                <span style={{ color: 'var(--color-primary)' }}>{descSizeInfo.label}</span>
              </label>
              <div className="btn-group-segmented" style={{ marginTop: '6px' }}>
                {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
                  <button
                    key={size}
                    type="button"
                    className={`btn-segmented ${mergedSettings.page_desc_size === size ? 'active' : ''}`}
                    onClick={() => updateSetting('page_desc_size', size)}
                  >
                    {size === 'small' && 'S (เล็ก)'}
                    {size === 'medium' && 'M (ปกติ)'}
                    {size === 'large' && 'L (ใหญ่)'}
                    {size === 'xlarge' && 'XL (พิเศษ)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Description Color */}
            <div style={{ marginTop: 'var(--space-3)' }}>
              <label className="page-style-label">
                <span>สีตัวอักษรรายละเอียด</span>
                <span className="color-hex-text">{mergedSettings.page_desc_color}</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <label className="color-input-preview" style={{ backgroundColor: mergedSettings.page_desc_color }}>
                  <input
                    type="color"
                    value={mergedSettings.page_desc_color}
                    onChange={e => updateSetting('page_desc_color', e.target.value)}
                  />
                </label>
                <div className="preset-swatches" style={{ margin: 0, flex: 1 }}>
                  {PRESET_TEXT_COLORS.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      title={c.name}
                      className={`preset-swatch-btn ${mergedSettings.page_desc_color.toLowerCase() === c.color.toLowerCase() ? 'active' : ''}`}
                      style={{ backgroundColor: c.color }}
                      onClick={() => updateSetting('page_desc_color', c.color)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Slot Header (หัวข้อเลือกรอบเวลา) */}
          <div className="page-style-control-group">
            <div className="page-style-section-title">
              <span>⏰</span>
              <span>หัวข้อเลือกรอบเวลา (Slot Header)</span>
            </div>

            {/* Slot Header Font Size */}
            <div style={{ marginTop: 'var(--space-2)' }}>
              <label className="page-style-label">
                <span>ขนาดตัวอักษรหัวข้อรอบเวลา</span>
                <span style={{ color: 'var(--color-primary)' }}>{slotHeaderSizeInfo.label}</span>
              </label>
              <div className="btn-group-segmented" style={{ marginTop: '6px' }}>
                {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
                  <button
                    key={size}
                    type="button"
                    className={`btn-segmented ${mergedSettings.page_slot_header_size === size ? 'active' : ''}`}
                    onClick={() => updateSetting('page_slot_header_size', size)}
                  >
                    {size === 'small' && 'S (เล็ก)'}
                    {size === 'medium' && 'M (ปกติ)'}
                    {size === 'large' && 'L (ใหญ่)'}
                    {size === 'xlarge' && 'XL (พิเศษ)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Slot Header Color */}
            <div style={{ marginTop: 'var(--space-3)' }}>
              <label className="page-style-label">
                <span>สีตัวอักษรหัวข้อรอบเวลา</span>
                <span className="color-hex-text">{mergedSettings.page_slot_header_color}</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <label className="color-input-preview" style={{ backgroundColor: mergedSettings.page_slot_header_color }}>
                  <input
                    type="color"
                    value={mergedSettings.page_slot_header_color}
                    onChange={e => updateSetting('page_slot_header_color', e.target.value)}
                  />
                </label>
                <div className="preset-swatches" style={{ margin: 0, flex: 1 }}>
                  {PRESET_TEXT_COLORS.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      title={c.name}
                      className={`preset-swatch-btn ${mergedSettings.page_slot_header_color.toLowerCase() === c.color.toLowerCase() ? 'active' : ''}`}
                      style={{ backgroundColor: c.color }}
                      onClick={() => updateSetting('page_slot_header_color', c.color)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Slot Card Content & Style (การ์ดรอบเวลา) */}
          <div className="page-style-control-group">
            <div className="page-style-section-title">
              <span>⏰</span>
              <span>การ์ดรอบเวลา (Slot Card Customization)</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
              ปรับลำดับการแสดงผล (วัน, เวลา, หรือจำนวนคงเหลือ) กำหนดขนาดตัวอักษร และขนาดของการ์ดรอบเวลาได้ตามต้องการ
            </div>

            {/* Sub-section A: Reordering Slot Items */}
            <div style={{ marginTop: 'var(--space-2)' }}>
              <label className="page-style-label">
                <span>ลำดับการแสดงผลในการ์ดรอบเวลา</span>
                <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem' }}>
                  {currentSlotOrder.map(k => k === 'time' ? 'เวลา' : k === 'date' ? 'วัน' : 'คงเหลือ').join(' ➔ ')}
                </span>
              </label>

              <div className="slot-order-list">
                {currentSlotOrder.map((key, idx) => {
                  const def = ITEM_DEFINITIONS[key]
                  return (
                    <div key={key} className="slot-order-item">
                      <div className="slot-order-item-left">
                        <span className="slot-order-badge">ลำดับที่ {idx + 1}</span>
                        <div>
                          <div className="slot-order-item-name">
                            <span>{def.icon}</span>
                            <span>{def.title}</span>
                          </div>
                          <div className="slot-order-item-example">
                            ตัวอย่าง: {def.previewText}
                          </div>
                        </div>
                      </div>
                      <div className="slot-order-actions">
                        <select
                          className="slot-order-select"
                          value={idx}
                          onChange={e => setSlotItemPosition(key, parseInt(e.target.value))}
                          aria-label={`เลือกลำดับของ ${def.title}`}
                        >
                          <option value={0}>อันดับ 1</option>
                          <option value={1}>อันดับ 2</option>
                          <option value={2}>อันดับ 3</option>
                        </select>
                        <button
                          type="button"
                          className="slot-order-btn"
                          disabled={idx === 0}
                          onClick={() => moveSlotItem(idx, 'up')}
                          title="เลื่อนขึ้น"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="slot-order-btn"
                          disabled={idx === currentSlotOrder.length - 1}
                          onClick={() => moveSlotItem(idx, 'down')}
                          title="เลื่อนลง"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Quick Presets */}
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  จัดลำดับรวดเร็ว (Quick Presets):
                </div>
                <div className="slot-order-presets">
                  {ORDER_PRESETS.map((preset, pIdx) => {
                    const isPresetActive = preset.order.every((k, i) => currentSlotOrder[i] === k)
                    return (
                      <button
                        key={pIdx}
                        type="button"
                        className={`slot-order-preset-btn ${isPresetActive ? 'active' : ''}`}
                        onClick={() => updateSetting('page_slot_order', [...preset.order])}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Sub-section B: Slot Card Size / Padding */}
            <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <label className="page-style-label">
                <span>ขนาดของการ์ดรอบเวลา (Card Size)</span>
                <span style={{ color: 'var(--color-primary)' }}>{slotCardSizeInfo.label}</span>
              </label>
              <div className="btn-group-segmented" style={{ marginTop: '6px' }}>
                {(['small', 'medium', 'large'] as const).map(size => (
                  <button
                    key={size}
                    type="button"
                    className={`btn-segmented ${mergedSettings.page_slot_card_size === size ? 'active' : ''}`}
                    onClick={() => updateSetting('page_slot_card_size', size)}
                  >
                    {size === 'small' && 'S (กะทัดรัด)'}
                    {size === 'medium' && 'M (ปกติ)'}
                    {size === 'large' && 'L (ใหญ่โปร่ง)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-section C: Element Details (Sizes & Colors) */}
            <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
                🎨 ปรับขนาดตัวอักษรและสีของแต่ละส่วน
              </div>

              {/* 1. Slot Time */}
              <div className="slot-style-subcard">
                <div className="slot-style-subcard-header">
                  <span>⏰ 1. เวลารอบ (Slot Time)</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>{slotTimeSizeInfo.label}</span>
                </div>
                <div>
                  <label className="page-style-label">
                    <span>ขนาดตัวอักษรเวลารอบ</span>
                  </label>
                  <div className="btn-group-segmented" style={{ marginTop: '4px' }}>
                    {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
                      <button
                        key={size}
                        type="button"
                        className={`btn-segmented ${mergedSettings.page_slot_time_size === size ? 'active' : ''}`}
                        onClick={() => updateSetting('page_slot_time_size', size)}
                      >
                        {size === 'small' && 'S (เล็ก)'}
                        {size === 'medium' && 'M (ปกติ)'}
                        {size === 'large' && 'L (ใหญ่)'}
                        {size === 'xlarge' && 'XL (พิเศษ)'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="page-style-label">
                    <span>สีตัวอักษรเวลารอบ</span>
                    <span className="color-hex-text">{mergedSettings.page_slot_time_color}</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                    <label className="color-input-preview" style={{ backgroundColor: mergedSettings.page_slot_time_color }}>
                      <input
                        type="color"
                        value={mergedSettings.page_slot_time_color}
                        onChange={e => updateSetting('page_slot_time_color', e.target.value)}
                      />
                    </label>
                    <div className="preset-swatches" style={{ margin: 0, flex: 1 }}>
                      {PRESET_TEXT_COLORS.map(c => (
                        <button
                          key={c.name}
                          type="button"
                          title={c.name}
                          className={`preset-swatch-btn ${mergedSettings.page_slot_time_color.toLowerCase() === c.color.toLowerCase() ? 'active' : ''}`}
                          style={{ backgroundColor: c.color }}
                          onClick={() => updateSetting('page_slot_time_color', c.color)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Slot Date */}
              <div className="slot-style-subcard">
                <div className="slot-style-subcard-header">
                  <span>📅 2. วันที่ (Slot Date)</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>{slotDateSizeInfo.label}</span>
                </div>
                <div>
                  <label className="page-style-label">
                    <span>ขนาดตัวอักษรวันที่</span>
                  </label>
                  <div className="btn-group-segmented" style={{ marginTop: '4px' }}>
                    {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
                      <button
                        key={size}
                        type="button"
                        className={`btn-segmented ${mergedSettings.page_slot_date_size === size ? 'active' : ''}`}
                        onClick={() => updateSetting('page_slot_date_size', size)}
                      >
                        {size === 'small' && 'S (เล็ก)'}
                        {size === 'medium' && 'M (ปกติ)'}
                        {size === 'large' && 'L (ใหญ่)'}
                        {size === 'xlarge' && 'XL (พิเศษ)'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="page-style-label">
                    <span>สีตัวอักษรวันที่</span>
                    <span className="color-hex-text">{mergedSettings.page_slot_date_color || '#94a3b8'}</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                    <label className="color-input-preview" style={{ backgroundColor: mergedSettings.page_slot_date_color || '#94a3b8' }}>
                      <input
                        type="color"
                        value={mergedSettings.page_slot_date_color || '#94a3b8'}
                        onChange={e => updateSetting('page_slot_date_color', e.target.value)}
                      />
                    </label>
                    <div className="preset-swatches" style={{ margin: 0, flex: 1 }}>
                      {PRESET_TEXT_COLORS.map(c => (
                        <button
                          key={c.name}
                          type="button"
                          title={c.name}
                          className={`preset-swatch-btn ${(mergedSettings.page_slot_date_color || '#94a3b8').toLowerCase() === c.color.toLowerCase() ? 'active' : ''}`}
                          style={{ backgroundColor: c.color }}
                          onClick={() => updateSetting('page_slot_date_color', c.color)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Slot Quota / Available */}
              <div className="slot-style-subcard">
                <div className="slot-style-subcard-header">
                  <span>👥 3. จำนวนคงเหลือ (Quota / Remaining)</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>{slotQuotaSizeInfo.label}</span>
                </div>
                <div>
                  <label className="page-style-label">
                    <span>ขนาดตัวอักษรจำนวนคงเหลือ</span>
                  </label>
                  <div className="btn-group-segmented" style={{ marginTop: '4px' }}>
                    {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
                      <button
                        key={size}
                        type="button"
                        className={`btn-segmented ${mergedSettings.page_slot_quota_size === size ? 'active' : ''}`}
                        onClick={() => updateSetting('page_slot_quota_size', size)}
                      >
                        {size === 'small' && 'S (เล็ก)'}
                        {size === 'medium' && 'M (ปกติ)'}
                        {size === 'large' && 'L (ใหญ่)'}
                        {size === 'xlarge' && 'XL (พิเศษ)'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="page-style-label">
                    <span>สีตัวอักษรจำนวนคงเหลือ</span>
                    <span className="color-hex-text">{mergedSettings.page_slot_quota_color || '#10b981'}</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                    <label className="color-input-preview" style={{ backgroundColor: mergedSettings.page_slot_quota_color || '#10b981' }}>
                      <input
                        type="color"
                        value={mergedSettings.page_slot_quota_color || '#10b981'}
                        onChange={e => updateSetting('page_slot_quota_color', e.target.value)}
                      />
                    </label>
                    <div className="preset-swatches" style={{ margin: 0, flex: 1 }}>
                      {PRESET_TEXT_COLORS.map(c => (
                        <button
                          key={c.name}
                          type="button"
                          title={c.name}
                          className={`preset-swatch-btn ${(mergedSettings.page_slot_quota_color || '#10b981').toLowerCase() === c.color.toLowerCase() ? 'active' : ''}`}
                          style={{ backgroundColor: c.color }}
                          onClick={() => updateSetting('page_slot_quota_color', c.color)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Slot Unit */}
                <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                  <label className="page-style-label">
                    <span>หน่วยของจำนวนที่ว่าง (เช่น คน, หน่วยงาน, ที่นั่ง)</span>
                    <span style={{ color: 'var(--color-primary)' }}>{mergedSettings.slot_unit || 'ที่'}</span>
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ maxWidth: '140px', padding: '6px 10px', fontSize: '0.875rem' }}
                      placeholder="เช่น คน, หน่วยงาน"
                      value={mergedSettings.slot_unit || ''}
                      onChange={e => updateSetting('slot_unit', e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {PRESET_SLOT_UNITS.map(unit => (
                        <button
                          key={unit}
                          type="button"
                          className={`btn btn-sm ${mergedSettings.slot_unit === unit ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '3px 8px', fontSize: '0.75rem', borderRadius: '4px' }}
                          onClick={() => updateSetting('slot_unit', unit)}
                        >
                          {unit}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Form Label Style */}
          <div className="page-style-control-group">
            <div className="page-style-section-title">
              <span>📝</span>
              <span>ตัวอักษรไกด์ฟอร์มลงทะเบียน (Form Label)</span>
            </div>

            {/* Form Label Color */}
            <div style={{ marginTop: 'var(--space-2)' }}>
              <label className="page-style-label">
                <span>สีตัวอักษรไกด์ (ชื่อ-นามสกุล, เบอร์โทรศัพท์ ฯลฯ)</span>
                <span className="color-hex-text">{mergedSettings.page_form_label_color || '#cbd5e1'}</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <label className="color-input-preview" style={{ backgroundColor: mergedSettings.page_form_label_color || '#cbd5e1' }}>
                  <input
                    type="color"
                    value={mergedSettings.page_form_label_color || '#cbd5e1'}
                    onChange={e => updateSetting('page_form_label_color', e.target.value)}
                  />
                </label>
                <div className="preset-swatches" style={{ margin: 0, flex: 1 }}>
                  {PRESET_TEXT_COLORS.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      title={c.name}
                      className={`preset-swatch-btn ${(mergedSettings.page_form_label_color || '#cbd5e1').toLowerCase() === c.color.toLowerCase() ? 'active' : ''}`}
                      style={{ backgroundColor: c.color }}
                      onClick={() => updateSetting('page_form_label_color', c.color)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Form Label Weight */}
            <div style={{ marginTop: 'var(--space-3)' }}>
              <label className="page-style-label">
                <span>ความเข้มตัวอักษรไกด์</span>
                <span style={{ color: 'var(--color-primary)' }}>
                  {mergedSettings.page_form_label_weight === 'normal' && 'บาง (Normal)'}
                  {mergedSettings.page_form_label_weight === 'medium' && 'ปกติ (Medium)'}
                  {(!mergedSettings.page_form_label_weight || mergedSettings.page_form_label_weight === 'medium') && 'ปกติ (Medium)'}
                  {mergedSettings.page_form_label_weight === 'semibold' && 'หนา (Semibold)'}
                  {mergedSettings.page_form_label_weight === 'bold' && 'หนามาก (Bold)'}
                </span>
              </label>
              <div className="btn-group-segmented" style={{ marginTop: '6px' }}>
                {(['normal', 'medium', 'semibold', 'bold'] as const).map(w => (
                  <button
                    key={w}
                    type="button"
                    className={`btn-segmented ${(mergedSettings.page_form_label_weight || 'medium') === w ? 'active' : ''}`}
                    onClick={() => updateSetting('page_form_label_weight', w)}
                  >
                    {w === 'normal' && 'บาง'}
                    {w === 'medium' && 'ปกติ'}
                    {w === 'semibold' && 'หนา'}
                    {w === 'bold' && 'หนามาก'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 6: Booking Page Background */}
          <div className="page-style-control-group">
            <div className="page-style-section-title">
              <span>🎨</span>
              <span>พื้นหลังหน้าจองคิวและฟอร์ม (Page Background)</span>
            </div>

            {/* Background Type Toggle */}
            <div style={{ marginTop: 'var(--space-2)' }}>
              <label className="page-style-label">
                <span>รูปแบบพื้นหลัง</span>
              </label>
              <div className="btn-group-segmented" style={{ marginTop: '6px' }}>
                <button
                  type="button"
                  className={`btn-segmented ${mergedSettings.page_bg_type === 'default' ? 'active' : ''}`}
                  onClick={() => updateSetting('page_bg_type', 'default')}
                >
                  ค่าเริ่มต้น
                </button>
                <button
                  type="button"
                  className={`btn-segmented ${mergedSettings.page_bg_type === 'color' ? 'active' : ''}`}
                  onClick={() => updateSetting('page_bg_type', 'color')}
                >
                  สีพื้นหลัง
                </button>
                <button
                  type="button"
                  className={`btn-segmented ${mergedSettings.page_bg_type === 'image' ? 'active' : ''}`}
                  onClick={() => updateSetting('page_bg_type', 'image')}
                >
                  รูปภาพพื้นหลัง
                </button>
              </div>
            </div>

            {/* Background Color Picker */}
            {mergedSettings.page_bg_type === 'color' && (
              <div style={{ marginTop: 'var(--space-3)' }} className="fade-in">
                <label className="page-style-label">
                  <span>เลือกสีพื้นหลังหน้าเว็บ</span>
                  <span className="color-hex-text">{mergedSettings.page_bg_color}</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                  <label className="color-input-preview" style={{ backgroundColor: mergedSettings.page_bg_color }}>
                    <input
                      type="color"
                      value={mergedSettings.page_bg_color}
                      onChange={e => updateSetting('page_bg_color', e.target.value)}
                    />
                  </label>
                  <div className="preset-swatches" style={{ margin: 0, flex: 1 }}>
                    {PRESET_PAGE_BG_COLORS.map(c => (
                      <button
                        key={c.name}
                        type="button"
                        title={c.name}
                        className={`preset-swatch-btn ${mergedSettings.page_bg_color.toLowerCase() === c.color.toLowerCase() ? 'active' : ''}`}
                        style={{ backgroundColor: c.color }}
                        onClick={() => updateSetting('page_bg_color', c.color)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Background Image Upload */}
            {mergedSettings.page_bg_type === 'image' && (
              <div style={{ marginTop: 'var(--space-3)' }} className="fade-in">
                <label className="page-style-label">
                  <span>อัปโหลดรูปภาพพื้นหลัง</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>PNG, JPG สูงสุด 5MB</span>
                </label>
                <div className="bg-image-upload-area">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  {mergedSettings.page_bg_image ? (
                    <div className="bg-image-preview-box">
                      <img src={mergedSettings.page_bg_image} alt="Background Preview" />
                      <div className="bg-image-preview-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={uploading}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          🔄 เปลี่ยนรูป
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={uploading}
                          onClick={() => updateSetting('page_bg_image', null)}
                        >
                          ✕ ลบรูป
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="bg-image-dropzone"
                      onClick={() => !uploading && fileInputRef.current?.click()}
                    >
                      <span style={{ fontSize: '2rem' }}>🖼️</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {uploading ? 'กำลังอัปโหลด...' : 'คลิกเพื่ออัปโหลดรูปภาพพื้นหลัง'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        แนะนำรูปแนวนอน ความละเอียด 1920x1080 ขึ้นไป
                      </span>
                    </div>
                  )}
                </div>

                {/* Overlay darkness slider */}
                {mergedSettings.page_bg_image && (
                  <div style={{ marginTop: 'var(--space-3)' }}>
                    <label className="page-style-label">
                      <span>ความมืดของฉากบังภาพ (Overlay)</span>
                      <span className="slider-value">{mergedSettings.page_bg_overlay}%</span>
                    </label>
                    <div className="slider-control" style={{ marginTop: '6px' }}>
                      <input
                        type="range"
                        min="0"
                        max="90"
                        step="5"
                        value={mergedSettings.page_bg_overlay}
                        onChange={e => updateSetting('page_bg_overlay', Number(e.target.value))}
                      />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      เพิ่มความมืดเพื่อให้อ่านข้อความและฟอร์มการจองได้ชัดเจน
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Card Theme Selection */}
            <div style={{ marginTop: 'var(--space-4)' }}>
              <label className="page-style-label">
                <span>รูปแบบการ์ดและฟอร์ม</span>
              </label>
              <div className="btn-group-segmented" style={{ marginTop: '6px' }}>
                <button
                  type="button"
                  className={`btn-segmented ${mergedSettings.page_card_theme === 'glass' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('glass')}
                >
                  กระจก (Glass)
                </button>
                <button
                  type="button"
                  className={`btn-segmented ${mergedSettings.page_card_theme === 'solid' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('solid')}
                >
                  ทึบเข้ม (Solid)
                </button>
                <button
                  type="button"
                  className={`btn-segmented ${mergedSettings.page_card_theme === 'light' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('light')}
                >
                  โทนสว่าง (Light)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview Column */}
        <div className="page-preview-box">
          <div className="page-preview-header">
            <div className="page-preview-title">
              <span>👁️</span>
              <span>ตัวอย่างการแสดงผลหน้าจองคิว</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Real-time</span>
          </div>

          <div
            className="page-preview-canvas"
            style={{
              backgroundColor:
                mergedSettings.page_bg_type === 'color'
                  ? mergedSettings.page_bg_color
                  : mergedSettings.page_bg_type === 'image' && mergedSettings.page_bg_image
                  ? '#0a0f1e'
                  : 'var(--color-bg-base)',
              backgroundImage:
                mergedSettings.page_bg_type === 'image' && mergedSettings.page_bg_image
                  ? `url("${mergedSettings.page_bg_image}")`
                  : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {/* Background image overlay in preview */}
            {mergedSettings.page_bg_type === 'image' && mergedSettings.page_bg_image && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: `rgba(0, 0, 0, ${mergedSettings.page_bg_overlay / 100})`,
                  zIndex: 1,
                }}
              />
            )}

            <div className="page-preview-content">
              {/* Event Card Preview */}
              <div className={`page-preview-event-card theme-${mergedSettings.page_card_theme}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      fontWeight: 600,
                    }}
                  >
                    ● เปิดรับจอง
                  </span>
                </div>

                {/* Title */}
                <h2
                  style={{
                    color: mergedSettings.page_title_color,
                    fontSize: titleSizeInfo.fontSize,
                    fontWeight: 800,
                    margin: 0,
                    lineHeight: 1.25,
                    wordBreak: 'break-word',
                  }}
                >
                  {eventTitle || 'ชื่องานกิจกรรม'}
                </h2>

                {/* Description */}
                <div
                  style={{
                    color: mergedSettings.page_desc_color,
                    fontSize: descSizeInfo.fontSize,
                    marginTop: '8px',
                    marginBottom: 0,
                    lineHeight: 1.55,
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  <FormattedText text={eventDesc || 'รายละเอียดกิจกรรมสำหรับการจองคิว เช่น เวลา สถานที่ หรือเงื่อนไขต่างๆ'} />
                </div>
              </div>

              {/* Slot Picker Preview */}
              <div className={`page-preview-event-card theme-${mergedSettings.page_card_theme} page-preview-slot-card-section`}>
                <div
                  style={{
                    fontSize: slotHeaderSizeInfo.fontSize,
                    fontWeight: 700,
                    color: mergedSettings.page_slot_header_color,
                    lineHeight: 1.3,
                  }}
                >
                  เลือกรอบเวลา
                </div>
                <div className="page-preview-slot-grid">
                  {/* Slot 1: Active */}
                  <div
                    className="page-preview-slot-card active"
                    style={{
                      padding: mergedSettings.page_slot_card_size === 'small' ? '6px 8px' : mergedSettings.page_slot_card_size === 'large' ? '12px 14px' : '8px 10px',
                    }}
                  >
                    {currentSlotOrder.map((key, idx) => {
                      if (key === 'time') {
                        return (
                          <div
                            key="time"
                            style={{
                              fontSize: slotTimeSizeInfo.fontSize,
                              fontWeight: 700,
                              color: mergedSettings.page_slot_time_color,
                              lineHeight: 1.25,
                              marginTop: idx > 0 ? '3px' : 0,
                            }}
                          >
                            09:30 - 12:00
                          </div>
                        )
                      }
                      if (key === 'date') {
                        return (
                          <div
                            key="date"
                            style={{
                              fontSize: slotDateSizeInfo.fontSize,
                              color: mergedSettings.page_slot_date_color || '#94a3b8',
                              lineHeight: 1.25,
                              marginTop: idx > 0 ? '3px' : 0,
                              fontWeight: 500,
                            }}
                          >
                            26 ต.ค. {new Date().getFullYear() + 543}
                          </div>
                        )
                      }
                      if (key === 'quota') {
                        return (
                          <div
                            key="quota"
                            style={{
                              fontSize: slotQuotaSizeInfo.fontSize,
                              fontWeight: 600,
                              color: mergedSettings.page_slot_quota_color || '#10b981',
                              lineHeight: 1.25,
                              marginTop: idx > 0 ? '3px' : 0,
                            }}
                          >
                            ว่าง 50/50 {mergedSettings.slot_unit || 'ที่'}
                          </div>
                        )
                      }
                      return null
                    })}
                  </div>

                  {/* Slot 2: Normal */}
                  <div
                    className="page-preview-slot-card"
                    style={{
                      padding: mergedSettings.page_slot_card_size === 'small' ? '6px 8px' : mergedSettings.page_slot_card_size === 'large' ? '12px 14px' : '8px 10px',
                    }}
                  >
                    {currentSlotOrder.map((key, idx) => {
                      if (key === 'time') {
                        return (
                          <div
                            key="time"
                            style={{
                              fontSize: slotTimeSizeInfo.fontSize,
                              fontWeight: 700,
                              color: mergedSettings.page_slot_time_color,
                              lineHeight: 1.25,
                              marginTop: idx > 0 ? '3px' : 0,
                            }}
                          >
                            13:00 - 16:30
                          </div>
                        )
                      }
                      if (key === 'date') {
                        return (
                          <div
                            key="date"
                            style={{
                              fontSize: slotDateSizeInfo.fontSize,
                              color: mergedSettings.page_slot_date_color || '#94a3b8',
                              lineHeight: 1.25,
                              marginTop: idx > 0 ? '3px' : 0,
                              fontWeight: 500,
                            }}
                          >
                            26 ต.ค. {new Date().getFullYear() + 543}
                          </div>
                        )
                      }
                      if (key === 'quota') {
                        return (
                          <div
                            key="quota"
                            style={{
                              fontSize: slotQuotaSizeInfo.fontSize,
                              fontWeight: 600,
                              color: mergedSettings.page_slot_quota_color || '#10b981',
                              lineHeight: 1.25,
                              marginTop: idx > 0 ? '3px' : 0,
                            }}
                          >
                            ว่าง 45/50 {mergedSettings.slot_unit || 'ที่'}
                          </div>
                        )
                      }
                      return null
                    })}
                  </div>
                </div>
              </div>

              {/* Booking Form Preview */}
              <div className={`page-preview-event-card theme-${mergedSettings.page_card_theme} page-preview-form-card`}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: mergedSettings.page_card_theme === 'light' ? '#1e293b' : 'var(--color-text-primary)' }}>
                  📋 ฟอร์มลงทะเบียนจองคิว
                </div>
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '0.65rem', color: mergedSettings.page_form_label_color || '#cbd5e1', fontWeight: mergedSettings.page_form_label_weight === 'normal' ? 400 : mergedSettings.page_form_label_weight === 'semibold' ? 600 : mergedSettings.page_form_label_weight === 'bold' ? 700 : 500, marginBottom: '3px' }}>ชื่อ-นามสกุล</div>
                  <div className="page-preview-mock-input">
                    <span>👤 ชื่อ-นามสกุล</span>
                  </div>
                </div>
                <div style={{ marginTop: '6px' }}>
                  <div style={{ fontSize: '0.65rem', color: mergedSettings.page_form_label_color || '#cbd5e1', fontWeight: mergedSettings.page_form_label_weight === 'normal' ? 400 : mergedSettings.page_form_label_weight === 'semibold' ? 600 : mergedSettings.page_form_label_weight === 'bold' ? 700 : 500, marginBottom: '3px' }}>เบอร์โทรศัพท์</div>
                  <div className="page-preview-mock-input">
                    <span>📞 เบอร์โทรศัพท์</span>
                  </div>
                </div>
                <div className="page-preview-mock-btn">
                  📋 ลงทะเบียน/จองคิว
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
