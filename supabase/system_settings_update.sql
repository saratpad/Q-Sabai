-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default system name if it doesn't exist
INSERT INTO public.system_settings (key, value)
VALUES ('system_name', '{"name": "Q-Sabai", "description": "ระบบจัดคิว สลน."}')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read settings (anonymous and authenticated)
DROP POLICY IF EXISTS "Anyone can view system settings" ON public.system_settings;
CREATE POLICY "Anyone can view system settings"
  ON public.system_settings FOR SELECT
  USING (true);

-- Allow only admins to update/insert settings
DROP POLICY IF EXISTS "Admins can insert system settings" ON public.system_settings;
CREATE POLICY "Admins can insert system settings"
  ON public.system_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update system settings" ON public.system_settings;
CREATE POLICY "Admins can update system settings"
  ON public.system_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete system settings" ON public.system_settings;
CREATE POLICY "Admins can delete system settings"
  ON public.system_settings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
