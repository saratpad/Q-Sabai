import { useState, useEffect } from 'react'
import { useSystemStore } from '../../stores/systemStore'
import toast from 'react-hot-toast'
import './AdminSettingsPage.css'

export default function AdminSettingsPage() {
  const { systemName, systemDesc, setSystemSettings } = useSystemStore()
  const [formData, setFormData] = useState({
    name: systemName,
    desc: systemDesc
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setFormData({ name: systemName, desc: systemDesc })
  }, [systemName, systemDesc])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast.error('กรุณาระบุชื่อระบบ')
      return
    }

    setIsSaving(true)
    const success = await setSystemSettings(formData.name.trim(), formData.desc.trim())
    setIsSaving(false)

    if (success) {
      toast.success('บันทึกการตั้งค่าระบบแล้ว')
    } else {
      toast.error('ไม่สามารถบันทึกการตั้งค่าได้')
    }
  }

  return (
    <div className="admin-settings-page fade-in">
      <div className="page-header">
        <h1>⚙️ ตั้งค่าระบบ (System Settings)</h1>
        <p>จัดการการตั้งค่าพื้นฐานของระบบที่แสดงผลต่อผู้ใช้งานทั้งหมด</p>
      </div>

      <div className="settings-container">
        <div className="settings-card">
          <form onSubmit={handleSave} className="settings-form">
            <div className="form-group">
              <label>
                ชื่อระบบ (System Name) <span className="required">*</span>
              </label>
              <input
                type="text"
                className="input-field"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="เช่น Q-Sabai"
                maxLength={50}
                required
              />
              <p className="field-hint">ชื่อนี้จะไปแสดงในหน้าจองคิว หน้าแสดงผล และหัวเว็บ</p>
            </div>

            <div className="form-group">
              <label>
                คำอธิบายระบบ (System Description)
              </label>
              <input
                type="text"
                className="input-field"
                value={formData.desc}
                onChange={e => setFormData({ ...formData, desc: e.target.value })}
                placeholder="เช่น ระบบจัดคิว สลน."
                maxLength={100}
              />
              <p className="field-hint">คำอธิบายย่อยที่จะแสดงในหน้าจอทีวีหรือหน้าล็อคอิน</p>
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isSaving || (formData.name === systemName && formData.desc === systemDesc)}
              >
                {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
