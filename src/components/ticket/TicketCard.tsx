import React from 'react'
import type { TicketSettings } from './ticketTypes'
import { DEFAULT_TICKET_SETTINGS, FONT_SIZE_MAP } from './ticketTypes'
import './TicketCustomizer.css'

export interface TicketCardProps {
  settings?: TicketSettings
  queueNumber?: string | number
  eventTitle?: string
  slotInfo?: string | null
  dateStr?: string
  isInteractivePreview?: boolean
  ticketRef?: React.RefObject<HTMLDivElement | null>
}

export const TicketCard: React.FC<TicketCardProps> = ({
  settings = DEFAULT_TICKET_SETTINGS,
  queueNumber = '001',
  eventTitle = 'ชื่อกิจกรรม / ชื่องานตัวอย่าง',
  slotInfo = 'รอบ: 09:00 - 10:00 น.',
  dateStr = '15 กันยายน 2569 09:30 น.',
  isInteractivePreview = false,
  ticketRef,
}) => {
  const isEnabled = settings.ticket_enabled !== false
  const bgType = settings.ticket_bg_type || 'color'
  const bgColor = settings.ticket_bg_color || '#111827'
  const bgImage = settings.ticket_bg_image || null
  const overlayOpacity = (settings.ticket_bg_overlay ?? 40) / 100
  const textColor = settings.ticket_text_color || '#f8fafc'
  const numberColor = settings.ticket_number_color || '#38bdf8'
  const fontSizeKey = settings.ticket_font_size || 'medium'
  const sizeStyles = FONT_SIZE_MAP[fontSizeKey] || FONT_SIZE_MAP.medium

  // Format queue number display
  const displayQueue = typeof queueNumber === 'number' 
    ? String(queueNumber).padStart(3, '0') 
    : String(queueNumber || '001')

  if (!isEnabled) {
    // Normal Queue Format (รูปแบบจองคิวธรรมดา)
    return (
      <div 
        ref={ticketRef} 
        className="standard-slip-preview"
        style={{
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-card)',
          color: 'var(--color-text-primary)'
        }}
      >
        <div className="standard-slip-icon">📋</div>
        <div className="standard-slip-title" style={{ fontSize: sizeStyles.title }}>{eventTitle}</div>
        <div className="standard-slip-label" style={{ fontSize: sizeStyles.label }}>หมายเลขคิวของคุณ</div>
        <div className="standard-slip-number" style={{ color: numberColor || 'var(--color-primary)', fontSize: sizeStyles.number }}>
          {displayQueue}
        </div>
        {slotInfo && (
          <div style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.95rem', margin: '4px 0' }}>
            {slotInfo}
          </div>
        )}
        <div className="standard-slip-divider" />
        <div className="standard-slip-info">
          จองเมื่อ {dateStr}
        </div>
        <div className="standard-slip-badge">
          ⏳ รอเรียกคิว
        </div>
        {isInteractivePreview && (
          <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            * ตัวอย่างรูปแบบจองคิวธรรมดา (ไม่ดาวน์โหลดตั๋วรูปภาพ)
          </div>
        )}
      </div>
    )
  }

  // Visual Ticket Format (รูปแบบตั๋วคิวตกแต่ง)
  const ticketStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: bgColor,
    backgroundImage: bgType === 'image' && bgImage ? `url("${bgImage}")` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    color: textColor,
    padding: sizeStyles.padding,
    borderRadius: '16px',
    border: '2px dashed rgba(255, 255, 255, 0.25)',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
    width: '100%',
    maxWidth: '320px',
    minHeight: '380px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: '10px',
    margin: '0 auto',
  }

  return (
    <div ref={ticketRef} className="booking-ticket custom-styled-ticket" style={ticketStyle}>
      {/* Dark overlay for background images to ensure contrast */}
      {bgType === 'image' && bgImage && (
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})`,
            zIndex: 0,
          }} 
        />
      )}

      {/* Content wrapper with z-index to stay above overlay */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div 
          className="booking-ticket-label" 
          style={{ 
            fontSize: sizeStyles.label, 
            color: textColor, 
            opacity: 0.8,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}
        >
          หมายเลขคิวของคุณ
        </div>

        <div 
          className="booking-ticket-number" 
          style={{ 
            fontSize: sizeStyles.number, 
            color: numberColor,
            WebkitTextFillColor: numberColor,
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            lineHeight: 1,
            margin: '6px 0',
            filter: `drop-shadow(0 0 16px ${numberColor}66)`,
          }}
        >
          {displayQueue}
        </div>

        <div 
          className="booking-ticket-event" 
          style={{ 
            fontSize: sizeStyles.title, 
            color: textColor,
            fontWeight: 700,
            lineHeight: 1.3,
            maxWidth: '260px',
            wordBreak: 'break-word',
          }}
        >
          {eventTitle}
        </div>

        {slotInfo && (
          <div 
            className="booking-ticket-slot" 
            style={{ 
              fontSize: sizeStyles.slot, 
              color: numberColor,
              fontWeight: 600,
              margin: '2px 0',
            }}
          >
            {slotInfo}
          </div>
        )}

        <div 
          className="booking-ticket-date" 
          style={{ 
            fontSize: sizeStyles.date, 
            color: textColor,
            opacity: 0.75,
            marginTop: '4px',
          }}
        >
          จองเมื่อ {dateStr}
        </div>
      </div>
    </div>
  )
}
