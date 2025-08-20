-- Fix storage RLS policies for tenant-attachments bucket
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "tenant-upload-policy" ON storage.objects;
DROP POLICY IF EXISTS "tenant-read-policy" ON storage.objects;

-- Allow authenticated users to upload files to tenant-attachments bucket
CREATE POLICY "Allow authenticated uploads to tenant-attachments" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'tenant-attachments' 
  AND auth.uid() IS NOT NULL
);

-- Allow public read access to tenant-attachments (needed for OpenAI API)
CREATE POLICY "Allow public read from tenant-attachments" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'tenant-attachments');

-- Allow users to update their own uploads
CREATE POLICY "Allow users to update own uploads" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'tenant-attachments' 
  AND auth.uid() IS NOT NULL
);

-- Allow users to delete their own uploads
CREATE POLICY "Allow users to delete own uploads" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'tenant-attachments' 
  AND auth.uid() IS NOT NULL
);
