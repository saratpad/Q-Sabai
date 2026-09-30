import React, { useState, useRef } from 'react'
import { FormattedText } from './FormattedText'
import './DescriptionEditor.css'

export interface DescriptionEditorProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  rows?: number
}

export const DescriptionEditor: React.FC<DescriptionEditorProps> = ({
  value,
  onChange,
  label = 'รายละเอียด',
  placeholder = 'รายละเอียดเพิ่มเติม เช่น สถานที่ เงื่อนไขการใช้บริการ สิ่งที่ต้องเตรียมมา...',
  rows = 5,
}) => {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertFormatting = (before: string, after: string, defaultText: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.substring(start, end)
    const replacement = selected ? `${before}${selected}${after}` : `${before}${defaultText}${after}`

    const newValue = value.substring(0, start) + replacement + value.substring(end)
    onChange(newValue)

    setTimeout(() => {
      textarea.focus()
      if (selected) {
        textarea.setSelectionRange(start + before.length, end + before.length)
      } else {
        textarea.setSelectionRange(start + before.length, start + before.length + defaultText.length)
      }
    }, 0)
  }

  const insertBullet = () => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const prefix = start === 0 || value[start - 1] === '\n' ? '• ' : '\n• '
    const newValue = value.substring(0, start) + prefix + value.substring(start)
    onChange(newValue)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, start + prefix.length)
    }, 0)
  }

  const insertLink = () => {
    insertFormatting('[', '](https://example.com)', 'ชื่อลิงก์')
  }

  return (
    <div className="form-group desc-editor-container">
      {label && <label className="form-label">{label}</label>}

      {/* Toolbar */}
      <div className="desc-editor-toolbar">
        <div className="desc-toolbar-actions">
          <button
            type="button"
            className="desc-toolbar-btn"
            title="ตัวหนา (**ข้อความ**)"
            onClick={() => insertFormatting('**', '**', 'ข้อความหนา')}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className="desc-toolbar-btn"
            title="ตัวเอียง (*ข้อความ*)"
            onClick={() => insertFormatting('*', '*', 'ข้อความเอียง')}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            className="desc-toolbar-btn"
            title="รายการหัวข้อย่อย (• )"
            onClick={insertBullet}
          >
            •
          </button>
          <button
            type="button"
            className="desc-toolbar-btn"
            title="ใส่ลิงก์เว็บ ([ชื่อ](https://...))"
            onClick={insertLink}
          >
            🔗 ลิงก์
          </button>
        </div>

        <div className="desc-toolbar-tabs">
          <button
            type="button"
            className={`desc-tab-btn ${activeTab === 'write' ? 'active' : ''}`}
            onClick={() => setActiveTab('write')}
          >
            ✏️ เขียน
          </button>
          <button
            type="button"
            className={`desc-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            👁️ ตัวอย่าง
          </button>
        </div>
      </div>

      {/* Editor or Preview */}
      {activeTab === 'write' ? (
        <textarea
          ref={textareaRef}
          className="form-input form-textarea desc-editor-textarea"
          placeholder={placeholder}
          value={value}
          rows={rows}
          onChange={e => onChange(e.target.value)}
        />
      ) : (
        <div className="desc-editor-preview">
          {value.trim() ? (
            <FormattedText text={value} />
          ) : (
            <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              (ยังไม่มีรายละเอียด — สลับไปที่แท็บ "เขียน" เพื่อกรอกข้อความ)
            </span>
          )}
        </div>
      )}

      <div className="desc-editor-hint">
        <span>💡</span>
        <span>
          กด Enter เพื่อเว้นบรรทัด ข้อความจะแสดงผลเว้นวรรคและขึ้นบรรทัดใหม่ตามที่พิมพ์จริง
        </span>
      </div>
    </div>
  )
}
