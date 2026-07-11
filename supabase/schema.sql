-- Q-Sabai Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'attendee' CHECK (role IN ('organizer', 'attendee', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events table
CREATE TABLE public.events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organizer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  banner_url TEXT,
  queue_type TEXT NOT NULL DEFAULT 'unlimited' CHECK (queue_type IN ('unlimited', 'scheduled')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event slots (for scheduled queue type)
CREATE TABLE public.event_slots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 10,
  booked_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Custom fields (dynamic form questions)
CREATE TABLE public.custom_fields (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'phone', 'select', 'email', 'number')),
  options JSONB DEFAULT '[]',
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bookings table
CREATE TABLE public.bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  slot_id UUID REFERENCES public.event_slots(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  queue_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'present', 'absent', 'cancelled')),
  field_responses JSONB DEFAULT '{}',
  called_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Queue sessions (การเรียกคิว)
CREATE TABLE public.queue_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_numbers INTEGER[] DEFAULT '{}',
  call_count_per_round INTEGER NOT NULL DEFAULT 1,
  show_name BOOLEAN NOT NULL DEFAULT TRUE,
  language TEXT NOT NULL DEFAULT 'th' CHECK (language IN ('th', 'en')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LINE settings
CREATE TABLE public.line_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL UNIQUE,
  channel_access_token TEXT,
  group_id TEXT,
  notify_before_minutes INTEGER DEFAULT 5,
  notify_on_call BOOLEAN DEFAULT TRUE,
  notify_on_available BOOLEAN DEFAULT TRUE,
  notify_on_close BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_settings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own or admin can update any" ON public.profiles 
FOR UPDATE USING (
  auth.uid() = id OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Admin can delete profiles" ON public.profiles 
FOR DELETE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Profiles are insertable on signup" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Events policies
CREATE POLICY "Anyone can view active events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Organizers can create events" ON public.events FOR INSERT WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "Organizers can update their events" ON public.events FOR UPDATE USING (auth.uid() = organizer_id);
CREATE POLICY "Organizers can delete their events" ON public.events FOR DELETE USING (auth.uid() = organizer_id);

-- Event slots policies
CREATE POLICY "Anyone can view slots" ON public.event_slots FOR SELECT USING (true);
CREATE POLICY "Organizers can manage slots" ON public.event_slots FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND organizer_id = auth.uid())
);

-- Custom fields policies
CREATE POLICY "Anyone can view custom fields" ON public.custom_fields FOR SELECT USING (true);
CREATE POLICY "Organizers can manage custom fields" ON public.custom_fields FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND organizer_id = auth.uid())
);

-- Bookings policies
CREATE POLICY "Users can view their own bookings" ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Organizers can view all bookings for their events" ON public.bookings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND organizer_id = auth.uid())
);
CREATE POLICY "Anyone can create bookings" ON public.bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can cancel their own bookings" ON public.bookings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Organizers can manage bookings" ON public.bookings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND organizer_id = auth.uid())
);

-- Queue sessions policies
CREATE POLICY "Anyone can view queue sessions" ON public.queue_sessions FOR SELECT USING (true);
CREATE POLICY "Organizers can manage queue sessions" ON public.queue_sessions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND organizer_id = auth.uid())
);

-- LINE settings policies
CREATE POLICY "Organizers can manage LINE settings" ON public.line_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND organizer_id = auth.uid())
);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-increment queue number for unlimited queue
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

CREATE TRIGGER auto_queue_number
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  WHEN (NEW.queue_number = 0)
  EXECUTE FUNCTION public.assign_queue_number();

-- Update booked_count on slot when booking changes
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

CREATE TRIGGER update_slot_count
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_slot_booked_count();

-- =====================================================
-- REALTIME
-- =====================================================

-- Enable realtime for queue_sessions and bookings
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_slots;
