-- Update the assign_queue_number trigger function to support three numbering types:
-- 1. normal: sequential running numbers (default)
-- 2. round_reset: sequential starting from 1 for each round/slot
-- 3. round_fixed: fixed number range per round based on preceding slot capacities

CREATE OR REPLACE FUNCTION public.assign_queue_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
  v_settings JSONB;
  v_numbering_type TEXT;
  v_slot_offset INTEGER;
  v_prev_slots_capacity INTEGER;
  r RECORD;
BEGIN
  -- 1. Get event settings
  SELECT settings INTO v_settings FROM public.events WHERE id = NEW.event_id;
  v_numbering_type := COALESCE(v_settings->>'queue_numbering_type', 'normal');

  -- 2. Calculate next number based on type
  IF v_numbering_type = 'round_reset' AND NEW.slot_id IS NOT NULL THEN
    -- Reset numbering for each slot (1, 2, 3...)
    SELECT COALESCE(MAX(queue_number), 0) + 1
    INTO next_number
    FROM public.bookings
    WHERE slot_id = NEW.slot_id AND status != 'cancelled';

  ELSIF v_numbering_type = 'round_fixed' AND NEW.slot_id IS NOT NULL THEN
    -- Fixed offset per slot based on capacities of preceding slots
    -- First, get current slot details
    SELECT capacity, slot_date, start_time 
    INTO r 
    FROM public.event_slots 
    WHERE id = NEW.slot_id;

    -- Calculate total capacity of all slots preceding the current slot (sorted by date, start_time, then ID)
    SELECT COALESCE(SUM(capacity), 0)
    INTO v_prev_slots_capacity
    FROM public.event_slots
    WHERE event_id = NEW.event_id
      AND (
        slot_date < r.slot_date 
        OR (slot_date = r.slot_date AND start_time < r.start_time)
        OR (slot_date = r.slot_date AND start_time = r.start_time AND id < NEW.slot_id)
      );

    -- Calculate booking sequence within this slot by finding the first available number in the range [1, capacity]
    -- that is not currently assigned to any active (non-cancelled) booking in this slot.
    SELECT MIN(s.num)
    INTO v_slot_offset
    FROM generate_series(1, r.capacity) s(num)
    LEFT JOIN public.bookings b ON b.slot_id = NEW.slot_id 
                                AND b.status != 'cancelled' 
                                AND b.queue_number = v_prev_slots_capacity + s.num
    WHERE b.id IS NULL;

    -- If no gap is found (slot is full or over capacity), fall back to MAX(queue_number) + 1
    IF v_slot_offset IS NULL THEN
      SELECT COALESCE(MAX(queue_number) - v_prev_slots_capacity, 0) + 1
      INTO v_slot_offset
      FROM public.bookings
      WHERE slot_id = NEW.slot_id AND status != 'cancelled';
    END IF;

    next_number := v_prev_slots_capacity + v_slot_offset;

  ELSE
    -- Default / normal: sequential across the whole event
    SELECT COALESCE(MAX(queue_number), 0) + 1
    INTO next_number
    FROM public.bookings
    WHERE event_id = NEW.event_id AND status != 'cancelled';
  END IF;

  NEW.queue_number := next_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
