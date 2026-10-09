-- ==============================================================================
-- FIX BOOKING SEARCH & CANCELLATION BY PHONE NUMBER
-- Run this script in the Supabase SQL Editor
-- ==============================================================================

-- 1. Ensure all custom fields that are intended for phone numbers have field_type = 'phone'
UPDATE public.custom_fields
SET field_type = 'phone'
WHERE field_type = 'text'
  AND (
    label ILIKE '%โทร%'
    OR label ILIKE '%phone%'
    OR label ILIKE '%tel%'
    OR label ILIKE '%มือถือ%'
  );

-- 2. Drop existing RPC functions to avoid parameter signature mismatch
DROP FUNCTION IF EXISTS public.get_my_booking_by_phone(UUID, TEXT);
DROP FUNCTION IF EXISTS public.cancel_booking_by_phone(UUID, TEXT);
DROP FUNCTION IF EXISTS public.cancel_booking_by_phone(UUID, TEXT, UUID);

-- 3. Robust get_my_booking_by_phone function
-- Supports:
--   - 9-digit landline numbers (e.g. 021416809)
--   - 10-digit mobile numbers (e.g. 0851737334)
--   - Inputs with hyphens, spaces, country codes (+66 / 66)
--   - Values with extension notes or multiple numbers (e.g. '024 306 594 ต่อ 695 422 , 092 914 5499')
--   - Dynamic lookup across all field responses if field_type isn't explicitly 'phone'
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

-- 4. Robust cancel_booking_by_phone function
-- Supports optional p_booking_id to cancel an exact booking, or defaults to the latest waiting booking
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
    -- Cancel the specific booking after verifying phone ownership
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
    -- Cancel the latest waiting booking matching the phone
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
             OR (v_base_phone IS NOT NULL AND length(v_base_phone) >= 9 AND regexp_replace(kv.value, '[^0-9]', '', 'g') LIKE '%' || v_base_phone || '%')
             OR (length(regexp_replace(kv.value, '[^0-9]', '', 'g')) >= 9 AND v_clean_phone LIKE '%' || regexp_replace(kv.value, '[^0-9]', '', 'g') || '%')
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

  -- Decrement slot booked count if applicable
  IF v_slot_id IS NOT NULL THEN
    UPDATE public.event_slots
    SET booked_count = GREATEST(0, booked_count - 1)
    WHERE id = v_slot_id
      AND event_id = p_event_id;
  END IF;

  RETURN TRUE;
END;
$$;
