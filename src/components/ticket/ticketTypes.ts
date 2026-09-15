export interface TicketSettings {
  ticket_enabled?: boolean
  ticket_bg_type?: 'color' | 'image'
  ticket_bg_color?: string
  ticket_bg_image?: string | null
  ticket_bg_overlay?: number // 0-100%
  ticket_text_color?: string
  ticket_number_color?: string
  ticket_font_size?: 'small' | 'medium' | 'large' | 'xlarge'
}

export const DEFAULT_TICKET_SETTINGS: Required<TicketSettings> = {
  ticket_enabled: true,
  ticket_bg_type: 'color',
  ticket_bg_color: '#111827',
  ticket_bg_image: null as any,
  ticket_bg_overlay: 40,
  ticket_text_color: '#f8fafc',
  ticket_number_color: '#38bdf8',
  ticket_font_size: 'medium',
}

export const PRESET_BG_COLORS = [
  { name: 'Dark Navy', color: '#111827' },
  { name: 'Midnight', color: '#0f172a' },
  { name: 'Deep Space', color: '#18181b' },
  { name: 'Warm Charcoal', color: '#1c1917' },
  { name: 'Emerald Night', color: '#064e3b' },
  { name: 'Royal Purple', color: '#3b0764' },
  { name: 'Deep Indigo', color: '#1e1b4b' },
  { name: 'Burgundy', color: '#4c0519' },
  { name: 'Clean White', color: '#ffffff' },
]

export const PRESET_NUMBER_COLORS = [
  { name: 'Sky Blue', color: '#38bdf8' },
  { name: 'Emerald', color: '#10b981' },
  { name: 'Amber Gold', color: '#f59e0b' },
  { name: 'Rose Pink', color: '#f43f5e' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'Pure White', color: '#ffffff' },
  { name: 'Dark Navy', color: '#0f172a' },
]

export const FONT_SIZE_MAP = {
  small: {
    label: '0.7rem',
    number: '3.5rem',
    title: '0.9rem',
    slot: '0.95rem',
    date: '0.7rem',
    padding: '16px 20px',
  },
  medium: {
    label: '0.75rem',
    number: '4.75rem',
    title: '1.05rem',
    slot: '1.1rem',
    date: '0.75rem',
    padding: '24px 24px',
  },
  large: {
    label: '0.85rem',
    number: '5.75rem',
    title: '1.2rem',
    slot: '1.25rem',
    date: '0.85rem',
    padding: '28px 24px',
  },
  xlarge: {
    label: '0.95rem',
    number: '6.5rem',
    title: '1.35rem',
    slot: '1.4rem',
    date: '0.95rem',
    padding: '32px 24px',
  },
}
