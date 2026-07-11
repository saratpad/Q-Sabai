const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'booking', 'PublicBookingPage.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Remove `user` checks on fetchEventData and allow anonymous
code = code.replace(
`      // Check if user already booked
      if (user) {
        const { data } = await supabase
          .from('bookings')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .neq('status', 'cancelled')
          .maybeSingle()
        if (data) {
          setMyBooking(data)
          setStep('done')
        }
      }`,
`      // Removed logged-in user booking check since it's anonymous
      // If we want to persist across reload we could check localStorage, 
      // but the requirement is to use phone number search to find booking.
      const localBookingId = localStorage.getItem('booking_' + eventId)
      if (localBookingId) {
        const { data } = await supabase.from('bookings').select('*').eq('id', localBookingId).maybeSingle()
        if (data && data.status !== 'cancelled') {
          setMyBooking(data)
          setStep('done')
        }
      }`
);

// Add missing states for modal
const stateInsertPos = code.indexOf('const [step, setStep] = useState');
const newStates = `
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelPhone, setCancelPhone] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  
  `;
code = code.slice(0, stateInsertPos) + newStates + code.slice(stateInsertPos);

// 2. Validate phone in handleBook
code = code.replace(
  `  const handleBook = async () => {
    if (!event) return`,
  `  const handleBook = async () => {
    if (!event) return
    
    // validate mobile phone format
    const phoneField = customFields.find(f => f.field_type === 'phone');
    if (phoneField) {
      const phoneVal = fieldValues[phoneField.id];
      if (!/^0[689]\\d{8}$/.test(phoneVal || '')) {
        toast.error('กรุณากรอกเบอร์โทรศัพท์มือถือให้ถูกต้อง (10 หลัก เริ่มด้วย 06, 08, 09)');
        return;
      }
    }
`
);

// 3. Remove user check inside handleBook
code = code.replace(
`        .insert({
          event_id: event.id,
          slot_id: selectedSlot?.id || null,
          user_id: user.id,
          queue_number: 0, // auto-assigned by trigger
          status: 'waiting',
          field_responses: fieldValues,
        })`,
`        .insert({
          event_id: event.id,
          slot_id: selectedSlot?.id || null,
          user_id: user?.id || null, // Allow anonymous
          queue_number: 0, // auto-assigned by trigger
          status: 'waiting',
          field_responses: fieldValues,
        })`
);

// 4. Save to localStorage after booking
code = code.replace(
`      setMyBooking(data)
      setStep('done')`,
`      setMyBooking(data)
      setStep('done')
      localStorage.setItem('booking_' + eventId, data.id)`
);

// 5. Add search phone for cancellation
const searchFunction = `
  const handleSearchAndCancel = async () => {
    if (!cancelPhone.trim()) return
    if (!/^0[689]\\d{8}$/.test(cancelPhone)) {
      toast.error('กรุณากรอกเบอร์มือถือให้ถูกต้อง')
      return
    }
    
    setCancelLoading(true)
    const { data: bData, error: bError } = await supabase.rpc('get_my_booking_by_phone', {
      p_event_id: eventId,
      p_phone: cancelPhone
    })
    
    setCancelLoading(false)
    if (bError) {
      toast.error('เกิดข้อผิดพลาดในการค้นหา')
      return
    }
    
    if (bData && bData.length > 0) {
      if (confirm('พบการจองของคุณ คิวหมายเลข ' + bData[0].queue_number + '\\nต้องการยกเลิกการจองนี้ใช่ไหม?')) {
        const { data: cancelSuccess, error: cError } = await supabase.rpc('cancel_booking_by_phone', {
          p_event_id: eventId,
          p_phone: cancelPhone
        })
        if (cancelSuccess) {
          toast.success('ยกเลิกการจองเรียบร้อยแล้ว')
          setMyBooking(null)
          setStep('view')
          setShowCancelModal(false)
          localStorage.removeItem('booking_' + eventId)
          fetchEventData()
        } else {
          toast.error('ไม่สามารถยกเลิกการจองได้')
        }
      }
    } else {
      toast.error('ไม่พบการจองที่รอคิวสำหรับเบอร์โทรนี้')
    }
  }
`;
code = code.replace(`  const handleCancelBooking = async () => {`, searchFunction + '\n  const handleCancelBooking = async () => {');

// 6. Remove login prompt
const loginPromptStart = `{/* Not logged in block */}`;
const loginPromptEnd = `          {/* Actions */}`;
let startIdx = code.indexOf(loginPromptStart);
let endIdx = code.indexOf(loginPromptEnd);
if (startIdx !== -1 && endIdx !== -1) {
    code = code.slice(0, startIdx) + code.slice(endIdx);
}

// 7. Update Actions
const actionsStart = `{/* Actions */}`;
const actionsEnd = `ปิดรับการจองคิวแล้ว
                </div>
              )}
            </div>`;
startIdx = code.indexOf(actionsStart);
endIdx = code.indexOf(actionsEnd) + actionsEnd.length;

const viewStepActions = `
            {/* Actions */}
            <div className="booking-actions fade-in" style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {isEventOpen ? (
                <>
                  <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleStartBooking}>
                    จองคิวตอนนี้
                  </button>
                  <button className="btn btn-secondary btn-lg" style={{ width: '100%', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }} onClick={() => setShowCancelModal(true)}>
                    🔍 ค้นหา หรือ ยกเลิกการจอง
                  </button>
                </>
              ) : (
                <div className="empty-state" style={{ padding: 'var(--space-4)' }}>
                  ปิดรับการจองคิวแล้ว
                </div>
              )}
            </div>
`;
if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    code = code.slice(0, startIdx) + viewStepActions.trim() + code.slice(endIdx);
}

// 8. Add Cancel Modal JSX
const cancelModalJSX = `
      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="modal-overlay fade-in" onClick={() => setShowCancelModal(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ padding: 'var(--space-6)', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ marginBottom: 'var(--space-2)' }}>🔍 ค้นหาการจองของคุณ</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', fontSize: '0.875rem' }}>
              กรอกเบอร์โทรศัพท์มือถือที่ใช้ในการจองเพื่อดูข้อมูลหรือยกเลิกคิว
            </p>
            <input 
              type="tel"
              className="form-input" 
              placeholder="เช่น 0891234567" 
              value={cancelPhone} 
              onChange={e => setCancelPhone(e.target.value)}
              maxLength={10}
              style={{ marginBottom: 'var(--space-4)' }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowCancelModal(false)}>ปิด</button>
              <button className="btn btn-primary" onClick={handleSearchAndCancel} disabled={cancelLoading}>
                {cancelLoading ? 'กำลังค้นหา...' : 'ค้นหาการจอง'}
              </button>
            </div>
          </div>
        </div>
      )}
`;
const returnDiv = `    <div className="booking-page fade-in">`;
code = code.replace(returnDiv, returnDiv + cancelModalJSX);

fs.writeFileSync(filePath, code);
console.log("Updated PublicBookingPage.tsx successfully!");
