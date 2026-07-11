/**
 * OTP & Phone Number Utilities
 */

/** แปลงเบอร์ไทย → E.164 format (+66...) */
export function formatThaiPhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.startsWith('66') && digits.length >= 11) return '+' + digits.slice(0, 12)
  if (digits.startsWith('0') && digits.length === 10) return '+66' + digits.slice(1)
  if (digits.length === 9) return '+66' + digits
  return '+66' + digits
}

/** แสดงเบอร์ในรูปแบบไทย: +66812345678 → 081-234-5678 */
export function displayThaiPhone(e164: string): string {
  const local = e164.replace(/^\+66/, '0')
  return local.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
}

/** ซ่อนกลางเบอร์: 081-234-5678 → 081-***-5678 */
export function maskPhone(phone: string): string {
  const display = phone.startsWith('+66') ? displayThaiPhone(phone) : phone
  return display.replace(/(\d{3}-)\d{3}(-\d{4})/, '$1***$2')
}

/** ตรวจสอบว่าเบอร์ไทยถูกต้องหรือไม่ */
export function isValidThaiPhone(input: string): boolean {
  const digits = input.replace(/\D/g, '')
  return (
    (digits.startsWith('0') && digits.length === 10) ||
    (digits.startsWith('66') && digits.length === 11)
  )
}

/** สร้าง OTP สุ่ม N หลัก */
export function generateOTP(length = 6): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('')
}

/** ตรวจสอบว่า OTP หมดอายุหรือยัง */
export function isOtpExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true
  return new Date() > new Date(expiresAt)
}

/** สร้าง expiry time 10 นาทีจากตอนนี้ */
export function otpExpiresAt(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 10)
  return d.toISOString()
}
