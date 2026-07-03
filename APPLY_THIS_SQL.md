# Apply This Migration

Open your Supabase Dashboard → SQL Editor and run this SQL:

```sql
-- Fix 1: Create missing storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('complaint-photos', 'complaint-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif']),
  ('service-documents', 'service-documents', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Fix 2: Storage policies for complaint-photos
CREATE POLICY IF NOT EXISTS "complaint-photos: citizen uploads own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'complaint-photos' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY IF NOT EXISTS "complaint-photos: citizen reads own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'complaint-photos' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY IF NOT EXISTS "complaint-photos: admin/officer reads all"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'complaint-photos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'officer') OR public.has_role(auth.uid(), 'government_authority'))
  );

-- Fix 3: Storage policies for service-documents  
CREATE POLICY IF NOT EXISTS "service-docs: citizen own"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'service-documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'service-documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY IF NOT EXISTS "service-docs: officers read assigned"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'service-documents'
    AND EXISTS (
      SELECT 1 FROM public.service_applications s
      WHERE (storage.foldername(name))[2] = s.id::text
        AND s.assigned_officer_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "service-docs: admin/authority read all"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'service-documents'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'government_authority'))
  );

-- Fix 4: Allow citizen to insert complaint timeline on submission
DROP POLICY IF EXISTS "Timeline inserts" ON public.complaint_timeline;

CREATE POLICY "Timeline inserts" ON public.complaint_timeline
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Allow citizen to insert on their own complaint (for initial submission)
    EXISTS (
      SELECT 1 FROM public.complaints c 
      WHERE c.id = complaint_id 
        AND c.citizen_id = auth.uid()
    )
    OR
    -- Allow officer/admin to insert on assigned complaints
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id
        AND (c.assigned_officer_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'government_authority'))
    )
  );
```

## How to Apply

1. Go to https://supabase.com/dashboard/project/ogmmqtellajvoazuesyq/sql/new
2. Paste the SQL above
3. Click **Run**
4. Refresh your app — all storage and timeline issues will be fixed
