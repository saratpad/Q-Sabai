import { Outlet } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useSystemStore } from '../../stores/systemStore'
import { useNavigate } from 'react-router-dom'

export default function BookingLayout() {
  const { user, signOut } = useAuthStore()
  const { systemName } = useSystemStore()
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gradient-hero)' }}>
      <nav className="nav">
        <div className="container nav-inner">
          <div className="nav-logo" style={{ cursor: 'pointer' }} onClick={() => navigate('/my')}>
            <svg width="28" height="28" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '9px', boxShadow: '0 0 10px rgba(14,165,233,0.35)', flexShrink: 0 }}>
              <rect width="52" height="52" rx="16" fill="url(#blgrad)"/>
              <rect x="10" y="14" width="32" height="5" rx="2.5" fill="white" fillOpacity="0.9"/>
              <rect x="10" y="23.5" width="24" height="5" rx="2.5" fill="white" fillOpacity="0.6"/>
              <rect x="10" y="33" width="18" height="5" rx="2.5" fill="white" fillOpacity="0.4"/>
              <circle cx="40" cy="25" r="5" fill="white" fillOpacity="0.9"/>
              <path d="M33 37c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="white" strokeOpacity="0.9" strokeWidth="2" strokeLinecap="round"/>
              <defs>
                <linearGradient id="blgrad" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#0ea5e9"/>
                  <stop offset="1" stopColor="#6366f1"/>
                </linearGradient>
              </defs>
            </svg>
            <span>{systemName}</span>
          </div>
          <div className="nav-actions">
            <span className="nav-user-name">👤 {user?.display_name || user?.email}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/organizer')}>🏠 หน้าหลัก</button>
            <button className="btn btn-ghost btn-sm" onClick={async () => { await signOut(); navigate('/login') }}>
              ออกจากระบบ
            </button>
          </div>
        </div>
      </nav>
      <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-8)' }}>
        <Outlet />
      </div>
    </div>
  )
}
