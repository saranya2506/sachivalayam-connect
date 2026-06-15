
-- Add assignment ownership/timestamp/remarks to complaints
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS assigned_admin_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS assignment_remarks text;

-- Same for service applications
ALTER TABLE public.service_applications
  ADD COLUMN IF NOT EXISTS assigned_admin_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS assignment_remarks text;

-- Archive flag for admin registrations
ALTER TABLE public.admin_registrations
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id);
