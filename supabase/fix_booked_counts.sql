-- 1. Re-calculate booked_count for all existing slots to correct any mismatches
UPDATE public.event_slots s
SET booked_count = (
  SELECT COUNT(*) FROM public.bookings b
  WHERE b.slot_id = s.id AND b.status NOT IN ('cancelled', 'absent')
);

-- Update slots status based on recalculated counts
UPDATE public.event_slots
SET status = CASE
  WHEN booked_count >= capacity THEN 'full'
  ELSE 'open'
END;

-- 2. Drop the old trigger
DROP TRIGGER IF EXISTS update_slot_count ON public.bookings;

-- 3. Create or replace the trigger function to handle INSERT, UPDATE, and DELETE
CREATE OR REPLACE FUNCTION public.update_slot_booked_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT or UPDATE (new slot_id)
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.slot_id IS NOT NULL THEN
    UPDATE public.event_slots
    SET booked_count = (
      SELECT COUNT(*) FROM public.bookings
      WHERE slot_id = NEW.slot_id AND status NOT IN ('cancelled', 'absent')
    )
    WHERE id = NEW.slot_id;
    
    UPDATE public.event_slots
    SET status = CASE
      WHEN booked_count >= capacity THEN 'full'
      ELSE 'open'
    END
    WHERE id = NEW.slot_id;
  END IF;

  -- Handle UPDATE (old slot_id) when slot_id changes or is removed
  IF TG_OP = 'UPDATE' AND OLD.slot_id IS NOT NULL AND OLD.slot_id != COALESCE(NEW.slot_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    UPDATE public.event_slots
    SET booked_count = (
      SELECT COUNT(*) FROM public.bookings
      WHERE slot_id = OLD.slot_id AND status NOT IN ('cancelled', 'absent')
    )
    WHERE id = OLD.slot_id;
    
    UPDATE public.event_slots
    SET status = CASE
      WHEN booked_count >= capacity THEN 'full'
      ELSE 'open'
    END
    WHERE id = OLD.slot_id;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' AND OLD.slot_id IS NOT NULL THEN
    UPDATE public.event_slots
    SET booked_count = (
      SELECT COUNT(*) FROM public.bookings
      WHERE slot_id = OLD.slot_id AND status NOT IN ('cancelled', 'absent')
    )
    WHERE id = OLD.slot_id;
    
    UPDATE public.event_slots
    SET status = CASE
      WHEN booked_count >= capacity THEN 'full'
      ELSE 'open'
    END
    WHERE id = OLD.slot_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the new trigger covering DELETE
CREATE TRIGGER update_slot_count
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_slot_booked_count();
