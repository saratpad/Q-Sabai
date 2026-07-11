-- ปิด Email Confirmation สำหรับการพัฒนา (Development Mode)
-- รันใน Supabase SQL Editor

-- วิธีที่ 1: ยืนยัน user ที่มีอยู่แล้วทั้งหมด (กรณีสมัครแล้วแต่ยังไม่ได้ยืนยัน)
UPDATE auth.users 
SET email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- ======================================================
-- ⚠️  สำคัญ: ต้องปิด Email Confirmation ใน Dashboard ด้วย
-- ======================================================
-- ไปที่: Supabase Dashboard
--   → Authentication
--   → Providers  
--   → Email
--   → ปิด "Confirm email" toggle
--   → Save
-- ======================================================
