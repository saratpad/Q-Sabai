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
