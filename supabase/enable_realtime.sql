-- ==============================================================================
-- ENABLE REALTIME UPDATES FOR BOOKINGS
-- Run this in your Supabase SQL Editor if real-time updates are not working.
-- ==============================================================================

-- 1. Set replica identity to FULL for bookings table.
-- This ensures that when updates or deletions occur, the database sends all fields 
-- (including event_id) in the WAL payload so the Realtime filter event_id=eq.UUID can match.
ALTER TABLE public.bookings REPLICA IDENTITY FULL;

-- 2. Add tables to the supabase_realtime publication.
-- We use conditional checks to prevent "already member" errors.
DO $$
BEGIN
  -- Add bookings to publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_class c ON pr.prrelid = c.oid 
    JOIN pg_publication p ON pr.prpubid = p.oid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;

  -- Add queue_sessions to publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_class c ON pr.prrelid = c.oid 
    JOIN pg_publication p ON pr.prpubid = p.oid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'queue_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_sessions;
  END IF;

  -- Add event_slots to publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_class c ON pr.prrelid = c.oid 
    JOIN pg_publication p ON pr.prpubid = p.oid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'event_slots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_slots;
  END IF;
END $$;
