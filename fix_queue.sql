CREATE OR REPLACE FUNCTION public.assign_queue_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(queue_number), 0) + 1
  INTO next_number
  FROM public.bookings
  WHERE event_id = NEW.event_id;
  
  NEW.queue_number := next_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
