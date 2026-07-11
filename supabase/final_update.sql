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
CREATE OR REPLACE FUNCTION get_my_booking_by_phone(p_event_id UUID, p_phone TEXT)
RETURNS SETOF public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_phone_field_id UUID;
BEGIN
  -- Find the custom field ID that is of type 'phone' for this event
  SELECT id INTO v_phone_field_id 
  FROM public.custom_fields 
  WHERE event_id = p_event_id AND field_type = 'phone' 
  LIMIT 1;

  IF v_phone_field_id IS NULL THEN
    RETURN;
  END IF;

  -- Return the active booking(s) matching the phone number
  RETURN QUERY
  SELECT * FROM public.bookings
  WHERE event_id = p_event_id
    AND status NOT IN ('cancelled', 'absent')
    AND field_responses->>v_phone_field_id::text = p_phone
  ORDER BY created_at DESC;
END;
$$;

-- 5. Create RPC function to cancel a booking securely by phone number
CREATE OR REPLACE FUNCTION cancel_booking_by_phone(p_event_id UUID, p_phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_phone_field_id UUID;
  v_booking_id UUID;
BEGIN
  -- Find the phone field ID
  SELECT id INTO v_phone_field_id 
  FROM public.custom_fields 
  WHERE event_id = p_event_id AND field_type = 'phone' 
  LIMIT 1;

  IF v_phone_field_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Find the waiting booking
  SELECT id INTO v_booking_id
  FROM public.bookings
  WHERE event_id = p_event_id
    AND status = 'waiting'
    AND field_responses->>v_phone_field_id::text = p_phone
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_booking_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Cancel the booking
  UPDATE public.bookings 
  SET status = 'cancelled' 
  WHERE id = v_booking_id;

  -- Update event_slots booked_count if it's a scheduled slot
  UPDATE public.event_slots
  SET booked_count = GREATEST(0, booked_count - 1)
  WHERE id = (SELECT slot_id FROM public.bookings WHERE id = v_booking_id)
    AND event_id = p_event_id;

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
