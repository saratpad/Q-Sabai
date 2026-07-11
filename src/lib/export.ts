import * as XLSX from 'xlsx'
import type { BookingWithProfile, Event, CustomField } from './database.types'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

interface ExportOptions {
  event: Event
  bookings: BookingWithProfile[]
  customFields: CustomField[]
}

export const exportToExcel = (options: ExportOptions) => {
  const { event, bookings, customFields } = options

  // Build header row
  const headers = [
    'หมายเลขคิว',
    ...(event.queue_type === 'scheduled' ? ['รอบเวลา'] : []),
    'วันที่จอง',
    'สถานะ',
    ...customFields.map(f => f.label),
  ]

  // Build data rows
  const rows = bookings
    .filter(b => b.status !== 'cancelled')
    .sort((a, b) => a.queue_number - b.queue_number)
    .map(booking => {
      const responses = (booking.field_responses || {}) as Record<string, string>
      const slotStr = booking.event_slots ? `${booking.event_slots.start_time.slice(0,5)} - ${booking.event_slots.end_time.slice(0,5)}` : ''
      return [
        booking.queue_number,
        ...(event.queue_type === 'scheduled' ? [slotStr] : []),
        format(new Date(booking.created_at), 'dd/MM/yyyy HH:mm', { locale: th }),
        statusLabel(booking.status),
        ...customFields.map(f => responses[f.id] || ''),
      ]
    })

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // Column widths
  ws['!cols'] = [
    { wch: 12 },
    ...(event.queue_type === 'scheduled' ? [{ wch: 15 }] : []),
    { wch: 18 },
    { wch: 12 },
    ...customFields.map(() => ({ wch: 20 })),
  ]

  // Create workbook
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'ข้อมูลการจอง')

  // Download
  const filename = `${event.title}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
  XLSX.writeFile(wb, filename)
}

export const exportToCSV = (options: ExportOptions) => {
  const { event, bookings, customFields } = options

  const headers = [
    'หมายเลขคิว',
    ...(event.queue_type === 'scheduled' ? ['รอบเวลา'] : []),
    'วันที่จอง',
    'สถานะ',
    ...customFields.map(f => `"${f.label}"`),
  ]

  const rows = bookings
    .filter(b => b.status !== 'cancelled')
    .sort((a, b) => a.queue_number - b.queue_number)
    .map(booking => {
      const responses = (booking.field_responses || {}) as Record<string, string>
      const slotStr = booking.event_slots ? `${booking.event_slots.start_time.slice(0,5)} - ${booking.event_slots.end_time.slice(0,5)}` : ''
      const row = [
        booking.queue_number,
        ...(event.queue_type === 'scheduled' ? [slotStr] : []),
        format(new Date(booking.created_at), 'dd/MM/yyyy HH:mm', { locale: th }),
        statusLabel(booking.status),
        ...customFields.map(f => `"${(responses[f.id] || '').replace(/"/g, '""')}"`),
      ]
      return row.join(',')
    })

  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.title}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Open Google Sheets with data pre-filled via URL
export const exportToGoogleSheets = (options: ExportOptions) => {
  // Export CSV first, then instruct user to import to Google Sheets
  exportToCSV(options)
  setTimeout(() => {
    window.open('https://sheets.google.com', '_blank')
  }, 500)
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    waiting: 'รอเรียก',
    called: 'เรียกแล้ว',
    present: 'มาแล้ว',
    absent: 'ไม่มา',
    cancelled: 'ยกเลิก',
  }
  return labels[status] || status
}
