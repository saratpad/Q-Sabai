-- Create a new public bucket for event banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-banners', 'event-banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;



-- Policy: Anyone can view event-banners
CREATE POLICY "Public Access for event-banners" ON storage.objects
FOR SELECT USING (bucket_id = 'event-banners');

-- Policy: Authenticated users can upload event-banners
CREATE POLICY "Authenticated users can upload event-banners" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'event-banners' AND
  auth.role() = 'authenticated'
);

-- Policy: Users can update their own event-banners
CREATE POLICY "Users can update their own event-banners" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'event-banners' AND
  auth.uid() = owner
);

-- Policy: Users can delete their own event-banners
CREATE POLICY "Users can delete their own event-banners" ON storage.objects
FOR DELETE USING (
  bucket_id = 'event-banners' AND
  auth.uid() = owner
);
