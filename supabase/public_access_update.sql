-- Drop old authenticated-only policies
DROP POLICY IF EXISTS "Anyone authenticated can view active events" ON public.events;
DROP POLICY IF EXISTS "Anyone authenticated can view slots" ON public.event_slots;
DROP POLICY IF EXISTS "Anyone authenticated can view custom fields" ON public.custom_fields;
DROP POLICY IF EXISTS "Anyone authenticated can view queue sessions" ON public.queue_sessions;

-- Recreate policies to allow anyone (including unauthenticated public users) to read these records
CREATE POLICY "Anyone can view active events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Anyone can view slots" ON public.event_slots FOR SELECT USING (true);
CREATE POLICY "Anyone can view custom fields" ON public.custom_fields FOR SELECT USING (true);
CREATE POLICY "Anyone can view queue sessions" ON public.queue_sessions FOR SELECT USING (true);
