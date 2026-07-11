import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useSystemStore } from '../../stores/systemStore'
import toast from 'react-hot-toast'
import './LoginPage.css'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const { signInWithEmail, signUpWithEmail, loading } = useAuthStore()
  const { systemName, systemDesc } = useSystemStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
        toast.success('เข้าสู่ระบบสำเร็จ!')
      } else {
        if (!displayName.trim()) {
          toast.error('กรุณาใส่ชื่อ-นามสกุล')
          return
        }
        await signUpWithEmail(email, password, displayName)
        toast.success('สมัครสมาชิกสำเร็จ! 🎉')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      if (message.includes('Invalid login credentials')) {
        toast.error('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      } else if (message.includes('User already registered')) {
        toast.error('อีเมลนี้มีผู้ใช้งานแล้ว')
      } else {
        toast.error(message)
      }
    }
  }

  return (
    <div className="login-page">
      {/* Animated background */}
      <div className="login-bg">
        <div className="login-bg-orb orb-1" />
        <div className="login-bg-orb orb-2" />
        <div className="login-bg-orb orb-3" />
      </div>

      <div className="login-container fade-in">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="52" height="52" rx="16" fill="url(#grad)"/>
              {/* Queue lines */}
              <rect x="10" y="14" width="32" height="5" rx="2.5" fill="white" fillOpacity="0.9"/>
              <rect x="10" y="23.5" width="24" height="5" rx="2.5" fill="white" fillOpacity="0.6"/>
              <rect x="10" y="33" width="18" height="5" rx="2.5" fill="white" fillOpacity="0.4"/>
              {/* Person icon on right */}
              <circle cx="40" cy="25" r="5" fill="white" fillOpacity="0.9"/>
              <path d="M33 37c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="white" strokeOpacity="0.9" strokeWidth="2" strokeLinecap="round"/>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#0ea5e9"/>
                  <stop offset="1" stopColor="#6366f1"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h1 className="login-title">{systemName}</h1>
            <p className="login-subtitle">{systemDesc}</p>
          </div>
        </div>

        {/* Card */}
        <div className="login-card glass-card">
          {/* Tabs */}
          <div className="login-tabs">
            <button
              className={`login-tab ${mode === 'signin' ? 'active' : ''}`}
              onClick={() => setMode('signin')}
            >
              เข้าสู่ระบบ
            </button>
            <button
              className={`login-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => setMode('signup')}
            >
              สมัครสมาชิก
            </button>
            <div className={`login-tab-indicator ${mode === 'signup' ? 'right' : ''}`} />
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {mode === 'signup' && (
              <div className="form-group fade-in">
                <label className="form-label">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="กรอกชื่อ-นามสกุล"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">อีเมล</label>
              <input
                type="email"
                className="form-input"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">รหัสผ่าน</label>
              <input
                type="password"
                className="form-input"
                placeholder="รหัสผ่านอย่างน้อย 6 ตัว"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '8px' }}
              disabled={loading}
            >
              {loading ? (
                <><div className="spinner" />{mode === 'signin' ? 'กำลังเข้าสู่ระบบ...' : 'กำลังสมัคร...'}</>
              ) : (
                mode === 'signin' ? '🔑 เข้าสู่ระบบ' : '✨ สมัครสมาชิก'
              )}
            </button>
          </form>
        </div>

        <p className="login-footer">
          {systemName} © {new Date().getFullYear()} · ระบบจัดคิวสำหรับองค์กร
        </p>
      </div>
    </div>
  )
}
