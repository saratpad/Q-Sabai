-- 1. Create RPC function to clear all events for the current user
CREATE OR REPLACE FUNCTION clear_my_events()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function deletes all events created by the caller.
  -- Because of ON DELETE CASCADE, this will also delete:
  -- - bookings
  -- - custom_fields
  -- - event_slots
  -- - queue_sessions
  -- - line_settings
  
  DELETE FROM public.events
  WHERE organizer_id = auth.uid();
END;
$$;

-- 2. Add columns to events for Event Groups (sub-activities)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_group BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.events(id) ON DELETE CASCADE;

-- 3. Update RLS policies for events to ensure child events are readable
-- Actually, the existing policy "Anyone can view active events" already covers it if is_active is true.
-- "Organizers can create events" covers it if auth.uid() = organizer_id.
-- "Organizers can update their events" covers it.
