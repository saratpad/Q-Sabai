import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useSystemStore } from '../../stores/systemStore'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import './OrganizerLayout.css'

export default function OrganizerLayout() {
  const { user, signOut } = useAuthStore()
  const { systemName } = useSystemStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleClearAllData = async () => {
    const txt = window.prompt('การล้างข้อมูลจะลบงาน กิจกรรม และคิวทั้งหมดที่คุณสร้าง! พิมพ์คำว่า "ยืนยัน" เพื่อลบข้อมูล')
    if (txt === 'ยืนยัน') {
      try {
        const { error } = await supabase.rpc('clear_my_events')
        if (error) throw error
        toast.success('ล้างข้อมูลกิจกรรมทั้งหมดเรียบร้อยแล้ว')
        // Force reload to clear dashboard state
        window.location.reload()
      } catch (err: any) {
        console.error(err)
        toast.error('เกิดข้อผิดพลาดในการล้างข้อมูล')
      }
    }
  }

  return (
    <div className="organizer-layout">
      {/* Top Navigation */}
      <nav className="nav">
        <div className="container nav-inner">
          <div className="nav-logo">
            <svg width="32" height="32" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '10px', boxShadow: '0 0 12px rgba(14,165,233,0.4)', flexShrink: 0 }}>
              <rect width="52" height="52" rx="16" fill="url(#navgrad)"/>
              <rect x="10" y="14" width="32" height="5" rx="2.5" fill="white" fillOpacity="0.9"/>
              <rect x="10" y="23.5" width="24" height="5" rx="2.5" fill="white" fillOpacity="0.6"/>
              <rect x="10" y="33" width="18" height="5" rx="2.5" fill="white" fillOpacity="0.4"/>
              <circle cx="40" cy="25" r="5" fill="white" fillOpacity="0.9"/>
              <path d="M33 37c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="white" strokeOpacity="0.9" strokeWidth="2" strokeLinecap="round"/>
              <defs>
                <linearGradient id="navgrad" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#0ea5e9"/>
                  <stop offset="1" stopColor="#6366f1"/>
                </linearGradient>
              </defs>
            </svg>
            <span>{systemName}</span>
            <span className="nav-role-badge">ผู้จัดงาน</span>
          </div>
          <div className="nav-actions">
            <span className="nav-user-name">👤 {user?.display_name || user?.email}</span>
            <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
              ออกจากระบบ
            </button>
          </div>
        </div>
      </nav>

      <div className="organizer-body">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-section-title">เมนูหลัก</div>
          <NavLink to="/organizer" end className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            🏠 <span>แดชบอร์ด</span>
          </NavLink>


          <div className="sidebar-divider" />
          <div className="sidebar-section-title">บัญชีของฉัน</div>
          <NavLink to="/profile" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            👤 <span>ตั้งค่าโปรไฟล์</span>
          </NavLink>

          
          {user?.role === 'admin' && (
            <>
              <div className="sidebar-divider" />
              <div className="sidebar-section-title">ผู้ดูแลระบบ</div>
              <NavLink to="/admin/users" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                👥 <span>จัดการผู้ใช้งาน</span>
              </NavLink>
              <NavLink to="/admin/settings" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                ⚙️ <span>ตั้งค่าระบบ</span>
              </NavLink>
            </>
          )}

          <div style={{ marginTop: 'auto', paddingTop: 'var(--space-6)' }}>
            <button 
              className="btn btn-danger" 
              style={{ width: '100%', fontSize: '0.875rem' }} 
              onClick={handleClearAllData}
            >
              🗑️ ล้างข้อมูลทั้งหมด
            </button>
          </div>

        </aside>

        {/* Main Content */}
        <main className="organizer-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
