-- Fix triggers to be SECURITY DEFINER so they bypass RLS
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

