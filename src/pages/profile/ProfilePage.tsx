import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import toast from 'react-hot-toast'
import './ProfilePage.css'

export default function ProfilePage() {
  const { user, initialize } = useAuthStore()
  
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setIsUpdatingProfile(true)
    
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id)
      
    if (error) {
      toast.error('เกิดข้อผิดพลาดในการอัปเดตข้อมูล')
    } else {
      toast.success('อัปเดตข้อมูลส่วนตัวสำเร็จ')
      await initialize() // refresh auth store
    }
    
    setIsUpdatingProfile(false)
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน')
      return
    }
    if (newPassword.length < 6) {
      toast.error('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร')
      return
    }
    
    setIsUpdatingPassword(true)
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })
    
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ')
      setNewPassword('')
      setConfirmPassword('')
    }
    
    setIsUpdatingPassword(false)
  }

  if (!user) return null

  return (
    <div className="profile-container">
      <h1 style={{ marginBottom: 'var(--space-6)' }}>ตั้งค่าโปรไฟล์</h1>
      
      <div className="profile-grid">
        {/* Profile Info */}
        <div className="glass-card profile-card">
          <h2 style={{ marginBottom: 'var(--space-4)' }}>ข้อมูลส่วนตัว</h2>
          <form onSubmit={handleUpdateProfile}>
            <div className="form-group">
              <label className="form-label">อีเมล</label>
              <input
                className="form-input"
                type="email"
                value={user.email}
                disabled
                style={{ opacity: 0.6 }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">ชื่อที่แสดง</label>
              <input
                className="form-input"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">สิทธิ์การใช้งาน (Role)</label>
              <input
                className="form-input"
                type="text"
                value={user.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : user.role === 'organizer' ? 'ผู้จัดงาน (Organizer)' : 'ผู้รับบริการ (Attendee)'}
                disabled
                style={{ opacity: 0.6 }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 'var(--space-2)' }}
              disabled={isUpdatingProfile}
            >
              {isUpdatingProfile ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="glass-card profile-card">
          <h2 style={{ marginBottom: 'var(--space-4)' }}>เปลี่ยนรหัสผ่าน</h2>
          <form onSubmit={handleUpdatePassword}>
            <div className="form-group">
              <label className="form-label">รหัสผ่านใหม่</label>
              <input
                className="form-input"
                type="password"
                placeholder="ขั้นต่ำ 6 ตัวอักษร"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">ยืนยันรหัสผ่านใหม่</label>
              <input
                className="form-input"
                type="password"
                placeholder="ยืนยันรหัสผ่านอีกครั้ง"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: 'var(--space-2)' }}
              disabled={isUpdatingPassword || !newPassword}
            >
              {isUpdatingPassword ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'เปลี่ยนรหัสผ่าน'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
