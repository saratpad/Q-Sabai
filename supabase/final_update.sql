-- ==============================================================================
-- FINAL UPDATE SCRIPT (Run this in Supabase SQL Editor)
-- This script fixes the Anonymous Booking (RLS Error) and Admin Delete Error.
-- ==============================================================================

-- 1. Make user_id nullable in bookings table
ALTER TABLE public.bookings ALTER COLUMN user_id DROP NOT NULL;

-- 2. Drop old INSERT policy if it exists and restricted to auth.uid()
DROP POLICY IF EXISTS "Users can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;

-- 3. Create new INSERT policy allowing anyone to create bookings (anonymous)
CREATE POLICY "Anyone can create bookings" ON public.bookings FOR INSERT WITH CHECK (true);

-- 4. Create RPC function to get a user's active booking by phone number
DROP FUNCTION IF EXISTS public.get_my_booking_by_phone(UUID, TEXT);
DROP FUNCTION IF EXISTS public.cancel_booking_by_phone(UUID, TEXT);
DROP FUNCTION IF EXISTS public.cancel_booking_by_phone(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.get_my_booking_by_phone(p_event_id UUID, p_phone TEXT)
RETURNS SETOF public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clean_phone TEXT;
  v_base_phone TEXT;
BEGIN
  -- Strip all non-digit characters from search input
  v_clean_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');

  -- Normalize Thai international code 66xxxxxxxxx to 0xxxxxxxxx
  IF v_clean_phone LIKE '66%' AND length(v_clean_phone) >= 11 THEN
    v_clean_phone := '0' || substr(v_clean_phone, 3);
  END IF;

  IF v_clean_phone IS NULL OR length(v_clean_phone) < 6 THEN
    RETURN;
  END IF;

  -- Extract base phone number without extension if extension is appended
  IF length(v_clean_phone) > 10 AND v_clean_phone LIKE '02%' THEN
    v_base_phone := substr(v_clean_phone, 1, 9);
  ELSIF length(v_clean_phone) > 10 AND v_clean_phone LIKE '0%' THEN
    v_base_phone := substr(v_clean_phone, 1, 10);
  ELSE
    v_base_phone := v_clean_phone;
  END IF;

  RETURN QUERY
  SELECT b.*
  FROM public.bookings b
  WHERE b.event_id = p_event_id
    AND b.status NOT IN ('cancelled', 'absent')
    AND (
      -- Check any field response for matching digits or text
      EXISTS (
        SELECT 1 
        FROM jsonb_each_text(b.field_responses) kv
        WHERE regexp_replace(kv.value, '[^0-9]', '', 'g') = v_clean_phone
           OR regexp_replace(kv.value, '[^0-9]', '', 'g') LIKE '%' || v_clean_phone || '%'
           OR (v_base_phone IS NOT NULL AND length(v_base_phone) >= 9 AND regexp_replace(kv.value, '[^0-9]', '', 'g') LIKE '%' || v_base_phone || '%')
           OR (length(regexp_replace(kv.value, '[^0-9]', '', 'g')) >= 9 AND v_clean_phone LIKE '%' || regexp_replace(kv.value, '[^0-9]', '', 'g') || '%')
           OR kv.value ILIKE '%' || trim(p_phone) || '%'
      )
    )
  ORDER BY b.created_at DESC;
END;
$$;

-- 5. Create RPC function to cancel a booking securely by phone number
CREATE OR REPLACE FUNCTION public.cancel_booking_by_phone(
  p_event_id UUID, 
  p_phone TEXT, 
  p_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clean_phone TEXT;
  v_base_phone TEXT;
  v_target_booking_id UUID;
  v_slot_id UUID;
BEGIN
  v_clean_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');

  IF v_clean_phone LIKE '66%' AND length(v_clean_phone) >= 11 THEN
    v_clean_phone := '0' || substr(v_clean_phone, 3);
  END IF;

  IF v_clean_phone IS NULL OR length(v_clean_phone) < 6 THEN
    RETURN FALSE;
  END IF;

  IF length(v_clean_phone) > 10 AND v_clean_phone LIKE '02%' THEN
    v_base_phone := substr(v_clean_phone, 1, 9);
  ELSIF length(v_clean_phone) > 10 AND v_clean_phone LIKE '0%' THEN
    v_base_phone := substr(v_clean_phone, 1, 10);
  ELSE
    v_base_phone := v_clean_phone;
  END IF;

  IF p_booking_id IS NOT NULL THEN
    SELECT b.id, b.slot_id INTO v_target_booking_id, v_slot_id
    FROM public.bookings b
    WHERE b.id = p_booking_id
      AND b.event_id = p_event_id
      AND b.status = 'waiting'
      AND (
        EXISTS (
          SELECT 1 
          FROM jsonb_each_text(b.field_responses) kv
          WHERE regexp_replace(kv.value, '[^0-9]', '', 'g') = v_clean_phone
             OR regexp_replace(kv.value, '[^0-9]', '', 'g') LIKE '%' || v_clean_phone || '%'
             OR (v_base_phone IS NOT NULL AND length(v_base_phone) >= 9 AND regexp_replace(kv.value, '[^0-9]', '', 'g') LIKE '%' || v_base_phone || '%')
             OR (length(regexp_replace(kv.value, '[^0-9]', '', 'g')) >= 9 AND v_clean_phone LIKE '%' || regexp_replace(kv.value, '[^0-9]', '', 'g') || '%')
             OR kv.value ILIKE '%' || trim(p_phone) || '%'
        )
      );
  ELSE
    SELECT b.id, b.slot_id INTO v_target_booking_id, v_slot_id
    FROM public.bookings b
    WHERE b.event_id = p_event_id
      AND b.status = 'waiting'
      AND (
        EXISTS (
          SELECT 1 
          FROM jsonb_each_text(b.field_responses) kv
          WHERE regexp_replace(kv.value, '[^0-9]', '', 'g') = v_clean_phone
             OR regexp_replace(kv.value, '[^0-9]', '', 'g') LIKE '%' || v_clean_phone || '%'
             OR kv.value ILIKE '%' || trim(p_phone) || '%'
        )
      )
    ORDER BY b.created_at DESC
    LIMIT 1;
  END IF;

  IF v_target_booking_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Cancel the booking
  UPDATE public.bookings 
  SET status = 'cancelled' 
  WHERE id = v_target_booking_id;

  -- Update event_slots booked_count if it's a scheduled slot
  IF v_slot_id IS NOT NULL THEN
    UPDATE public.event_slots
    SET booked_count = GREATEST(0, booked_count - 1)
    WHERE id = v_slot_id
      AND event_id = p_event_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- 6. Function to safely delete a user (only callable by admins)
CREATE OR REPLACE FUNCTION delete_user_by_admin(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied. Only admins can delete users.';
  END IF;
  
  -- Delete the user from auth.users (this will cascade to profiles)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- 7. Fix triggers to be SECURITY DEFINER so they bypass RLS when anonymous users book
CREATE OR REPLACE FUNCTION public.assign_queue_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(queue_number), 0) + 1
  INTO next_number
  FROM public.bookings
  WHERE event_id = NEW.event_id AND status != 'cancelled';
  
  NEW.queue_number := next_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_slot_booked_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slot_id IS NOT NULL THEN
    UPDATE public.event_slots
    SET booked_count = (
      SELECT COUNT(*) FROM public.bookings
      WHERE slot_id = NEW.slot_id AND status NOT IN ('cancelled', 'absent')
    )
    WHERE id = NEW.slot_id;
    
    -- Update slot status
    UPDATE public.event_slots
    SET status = CASE
      WHEN booked_count >= capacity THEN 'full'
      ELSE 'open'
    END
    WHERE id = NEW.slot_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
