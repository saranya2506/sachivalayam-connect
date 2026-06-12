
CREATE POLICY "service-docs citizen own" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'service-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'service-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "service-docs staff read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'service-documents' AND (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'government_authority')
      OR public.has_role(auth.uid(),'officer')
    )
  );
