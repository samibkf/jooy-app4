/*
  # Secure PDF Access Migration

  1. Security Updates
    - Update RLS policy for private-pdfs bucket to restrict access based on document ownership
    - Remove overly permissive policy for authenticated users
    - Add proper document ownership verification

  2. Changes
    - Drop existing "Authenticated users can read private PDFs" policy
    - Create new restrictive policy that checks document ownership
    - Ensure only document owners can access their PDFs
*/

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can read private PDFs" ON storage.objects;

-- Create a more restrictive policy that checks document ownership
CREATE POLICY "Users can read their own document PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'private-pdfs' AND
  EXISTS (
    SELECT 1 FROM documents 
    WHERE documents.id = (storage.objects.name)::text 
    AND documents.user_id = auth.uid()
  )
);

-- Alternative policy if you want to use a different naming convention
-- This assumes PDF files are named with the document ID
CREATE POLICY "Users can read PDFs for their documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'private-pdfs' AND
  EXISTS (
    SELECT 1 FROM documents 
    WHERE CONCAT(documents.id, '.pdf') = storage.objects.name
    AND documents.user_id = auth.uid()
  )
);

-- Ensure service role can still manage all files (for admin operations)
-- This policy should already exist, but we're ensuring it's in place
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Service role can manage private PDFs'
  ) THEN
    CREATE POLICY "Service role can manage private PDFs"
    ON storage.objects
    FOR ALL
    TO service_role
    USING (bucket_id = 'private-pdfs');
  END IF;
END $$;