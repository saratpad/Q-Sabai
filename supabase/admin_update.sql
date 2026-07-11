-- Update the role check constraint to allow 'admin'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('organizer', 'attendee', 'admin'));

-- Update RLS policy to allow admins to view all profiles and update any profile
-- Delete old policies to replace them cleanly
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Everyone can still view profiles (so attendees can see organizer names, etc.)
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);

-- Users can update their own profiles, OR admins can update any profile
CREATE POLICY "Users can update own or admin can update any" ON public.profiles 
FOR UPDATE USING (
  auth.uid() = id OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Admin can delete profiles" ON public.profiles 
FOR DELETE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
