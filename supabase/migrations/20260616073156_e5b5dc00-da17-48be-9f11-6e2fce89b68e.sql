ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id);

CREATE POLICY "gov authority updates audit logs"
  ON public.audit_logs FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'government_authority'::app_role))
  WITH CHECK (has_role(auth.uid(), 'government_authority'::app_role));