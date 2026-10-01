import { format } from 'date-fns'
import { th } from 'date-fns/locale'

/**
 * Format slot date with Thai Buddhist Era (พ.ศ.)
 * e.g. '2026-10-26' -> '26 ต.ค. 2569'
 */
export function formatThaiSlotDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  try {
    const cleanDateStr = dateStr.split('T')[0]
    const parts = cleanDateStr.split('-')
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const day = parseInt(parts[2], 10)
      const d = new Date(year, month, day)
      const thaiYear = year + 543
      return `${format(d, 'd MMM', { locale: th })} ${thaiYear}`
    }
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return `${format(d, 'd MMM', { locale: th })} ${d.getFullYear() + 543}`
  } catch {
    return dateStr
  }
}

/**
 * Format date & time with Thai Buddhist Era (พ.ศ.)
 * e.g. Date -> '26 ตุลาคม 2569 09:30 น.'
 */
export function formatThaiDateTime(date: Date | string | null | undefined): string {
  if (!date) return ''
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return String(date)
    const thaiYear = d.getFullYear() + 543
    return `${format(d, 'dd MMMM', { locale: th })} ${thaiYear} ${format(d, 'HH:mm น.', { locale: th })}`
  } catch {
    return String(date)
  }
}
