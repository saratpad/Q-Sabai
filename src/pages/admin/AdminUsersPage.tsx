import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/database.types'
import toast from 'react-hot-toast'
import './AdminUsersPage.css'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  

  // Edit User State
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editRole, setEditRole] = useState<'attendee' | 'organizer' | 'admin'>('attendee')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      
    if (error) {
      toast.error('ไม่สามารถดึงข้อมูลผู้ใช้ได้')
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('คุณต้องการลบผู้ใช้งานนี้อย่างถาวรใช่หรือไม่? (การกระทำนี้ไม่สามารถยกเลิกได้)')) return

    try {
      const { error } = await supabase.rpc('delete_user_by_admin', { p_user_id: userId })
      if (error) throw error

      toast.success('ลบผู้ใช้สำเร็จ')
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการลบผู้ใช้')
    }
  }

  const startEdit = (user: Profile) => {
    setEditingUserId(user.id)
    setEditDisplayName(user.display_name || '')
    setEditRole(user.role)
  }

  const cancelEdit = () => {
    setEditingUserId(null)
  }

  const handleSaveUser = async (userId: string) => {
    setIsSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: editDisplayName,
        role: editRole,
      })
      .eq('id', userId)

    if (error) {
      toast.error('เกิดข้อผิดพลาดในการแก้ไขข้อมูล')
    } else {
      toast.success('อัปเดตข้อมูลผู้ใช้สำเร็จ')
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, display_name: editDisplayName, role: editRole } : u))
      setEditingUserId(null)
    }
    setIsSaving(false)
  }

  return (
    <div className="admin-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <h1>👥 จัดการผู้ใช้งาน</h1>
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-elevated)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
          💡 ให้ผู้ใช้ไปที่เมนู <strong>เข้าสู่ระบบ &gt; สมัครสมาชิก</strong> จากนั้นแอดมินค่อยมากดแก้ไขสิทธิ์ที่นี่
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : (
        <div className="admin-users-list">
          {users.map(user => (
            <div key={user.id} className="glass-card user-card">
              {editingUserId === user.id ? (
                <div className="user-edit-form">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label">อีเมล</label>
                    <input className="form-input" value={user.email} disabled style={{ opacity: 0.6 }} />
                  </div>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label">ชื่อที่แสดง</label>
                    <input className="form-input" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label">สิทธิ์</label>
                    <select className="form-input" value={editRole} onChange={e => setEditRole(e.target.value as any)}>
                      <option value="attendee">Attendee</option>
                      <option value="organizer">Organizer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="user-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleSaveUser(user.id)} disabled={isSaving}>บันทึก</button>
                    <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>ยกเลิก</button>
                  </div>
                </div>
              ) : (
                <div className="user-view">
                  <div className="user-info">
                    <div className="user-email">{user.email}</div>
                    <div className="user-name">{user.display_name || 'ไม่มีชื่อ'}</div>
                  </div>
                  <div className="user-role">
                    <span className={`badge badge-${user.role}`}>{user.role.toUpperCase()}</span>
                  </div>
                  <div className="user-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => startEdit(user)}>📝 แก้ไข</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(user.id)}>🗑️ ลบ</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
