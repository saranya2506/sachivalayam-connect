
-- === 20260610164607_8639a074-ad4c-4074-9097-8a2fa3641e35.sql ===

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('government_authority','admin','officer','citizen');
CREATE TYPE public.admin_verification_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.complaint_status AS ENUM ('submitted','assigned','under_review','in_progress','resolved','rejected');
CREATE TYPE public.complaint_category AS ENUM ('water_supply','drainage','roads','street_lights','sanitation','certificates','pensions','others');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile_number TEXT,
  address TEXT,
  village TEXT,
  department TEXT,
  active_status BOOLEAN NOT NULL DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'government_authority' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'officer' THEN 3
    WHEN 'citizen' THEN 4 END
  LIMIT 1;
$$;

-- Profiles policies
CREATE POLICY "users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "gov authority reads all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'government_authority'));
CREATE POLICY "admin reads profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "officer reads profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'officer'));

-- user_roles policies
CREATE POLICY "user reads own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "gov authority reads all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'government_authority'));

-- ============ ADMIN REGISTRATIONS ============
CREATE TABLE public.admin_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL UNIQUE,
  district TEXT NOT NULL,
  mandal TEXT NOT NULL,
  village_ward TEXT NOT NULL,
  department TEXT NOT NULL,
  verification_status public.admin_verification_status NOT NULL DEFAULT 'pending',
  verification_remarks TEXT,
  verification_date TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.admin_registrations TO authenticated;
GRANT ALL ON public.admin_registrations TO service_role;
ALTER TABLE public.admin_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own admin reg" ON public.admin_registrations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "gov authority reads all admin regs" ON public.admin_registrations FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'government_authority'));
CREATE POLICY "user inserts own admin reg" ON public.admin_registrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ OFFICERS (extra metadata) ============
CREATE TABLE public.officers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.officers TO authenticated;
GRANT ALL ON public.officers TO service_role;
ALTER TABLE public.officers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read officers" ON public.officers FOR SELECT TO authenticated USING (true);

-- ============ COMPLAINTS ============
CREATE SEQUENCE public.complaint_id_seq START 1;

CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_number TEXT NOT NULL UNIQUE,
  citizen_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category public.complaint_category NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  photo_url TEXT,
  status public.complaint_status NOT NULL DEFAULT 'submitted',
  assigned_officer_id UUID REFERENCES auth.users(id),
  department TEXT,
  last_remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "citizen reads own complaints" ON public.complaints FOR SELECT TO authenticated USING (auth.uid() = citizen_id);
CREATE POLICY "officer reads assigned complaints" ON public.complaints FOR SELECT TO authenticated USING (auth.uid() = assigned_officer_id);
CREATE POLICY "admin reads all complaints" ON public.complaints FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "gov authority reads all complaints" ON public.complaints FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'government_authority'));
CREATE POLICY "citizen inserts own complaint" ON public.complaints FOR INSERT TO authenticated WITH CHECK (auth.uid() = citizen_id AND public.has_role(auth.uid(),'citizen'));
CREATE POLICY "officer updates assigned" ON public.complaints FOR UPDATE TO authenticated USING (auth.uid() = assigned_officer_id);
CREATE POLICY "admin updates complaints" ON public.complaints FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- complaint number generator
CREATE OR REPLACE FUNCTION public.gen_complaint_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.complaint_number IS NULL OR NEW.complaint_number = '' THEN
    NEW.complaint_number := 'CMP' || LPAD(nextval('public.complaint_id_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_gen_complaint_number BEFORE INSERT ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.gen_complaint_number();

-- ============ COMPLAINT TIMELINE ============
CREATE TABLE public.complaint_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  status public.complaint_status NOT NULL,
  remarks TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.complaint_timeline TO authenticated;
GRANT ALL ON public.complaint_timeline TO service_role;
ALTER TABLE public.complaint_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timeline visible to participants" ON public.complaint_timeline FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND (
    c.citizen_id = auth.uid() OR c.assigned_officer_id = auth.uid()
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'government_authority')
  ))
);
CREATE POLICY "timeline inserts" ON public.complaint_timeline FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND (
    c.assigned_officer_id = auth.uid() OR public.has_role(auth.uid(),'admin')
  ))
);

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user updates own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gov authority reads audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'government_authority'));

-- ============ AUTO PROFILE + DEFAULT ROLE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, mobile_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'mobile_number'
  ) ON CONFLICT (id) DO NOTHING;

  v_role := COALESCE((NEW.raw_user_meta_data->>'intended_role')::public.app_role, 'citizen');
  -- For admin self-registration we still insert the role; gating happens via admin_registrations.verification_status
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ BOOTSTRAP STATE TABLE ============
CREATE TABLE public.system_state (
  id INT PRIMARY KEY DEFAULT 1,
  bootstrap_completed BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT only_one_row CHECK (id = 1)
);
INSERT INTO public.system_state (id, bootstrap_completed) VALUES (1, FALSE);
GRANT SELECT ON public.system_state TO anon, authenticated;
GRANT ALL ON public.system_state TO service_role;
ALTER TABLE public.system_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads system state" ON public.system_state FOR SELECT TO anon, authenticated USING (true);

-- updated_at trigger reuse
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_complaints_updated BEFORE UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- === 20260610164639_01cb73e1-1946-4b24-a305-e3152d3d92ed.sql ===

-- Lock down search_path and execute grants
ALTER FUNCTION public.touch_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_complaint_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
-- still need authenticated to use has_role inside RLS, but RLS runs as the table owner; safer:
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;


-- === 20260610164704_72e15900-8daf-47bd-8659-632f99c9697c.sql ===

CREATE POLICY "authenticated upload own folder" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'complaint-photos' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "owner reads own complaint photo" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'complaint-photos' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'officer')
    OR public.has_role(auth.uid(),'government_authority')
  )
);


-- === 20260612173702_10a4427d-3794-4090-ae69-0081d5bce60a.sql ===

-- Service application status enum
CREATE TYPE public.service_app_status AS ENUM (
  'submitted','assigned','under_verification','documents_required','approved','rejected','completed'
);

CREATE TYPE public.service_app_type AS ENUM (
  'income_certificate','pension','ration_card','caste_certificate','residence_certificate','birth_certificate','death_certificate'
);

CREATE SEQUENCE IF NOT EXISTS public.service_app_id_seq START 1;

-- Main applications table
CREATE TABLE public.service_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number TEXT UNIQUE,
  citizen_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_type public.service_app_type NOT NULL,
  citizen_name TEXT NOT NULL,
  aadhaar_number TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  email TEXT,
  address TEXT NOT NULL,
  village TEXT NOT NULL,
  mandal TEXT NOT NULL,
  district TEXT NOT NULL,
  status public.service_app_status NOT NULL DEFAULT 'submitted',
  assigned_officer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  department TEXT,
  last_remark TEXT,
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_applications TO authenticated;
GRANT ALL ON public.service_applications TO service_role;
ALTER TABLE public.service_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Citizens manage own applications" ON public.service_applications
  FOR ALL TO authenticated
  USING (citizen_id = auth.uid())
  WITH CHECK (citizen_id = auth.uid());

CREATE POLICY "Officer sees assigned" ON public.service_applications
  FOR SELECT TO authenticated
  USING (assigned_officer_id = auth.uid());

CREATE POLICY "Officer updates assigned" ON public.service_applications
  FOR UPDATE TO authenticated
  USING (assigned_officer_id = auth.uid());

CREATE POLICY "Admin all applications" ON public.service_applications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'government_authority'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'government_authority'));

-- Auto-generate application number
CREATE OR REPLACE FUNCTION public.gen_application_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.application_number IS NULL OR NEW.application_number = '' THEN
    NEW.application_number := 'APP' || LPAD(nextval('public.service_app_id_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER service_applications_gen_number
  BEFORE INSERT ON public.service_applications
  FOR EACH ROW EXECUTE FUNCTION public.gen_application_number();

CREATE TRIGGER service_applications_touch
  BEFORE UPDATE ON public.service_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Required / uploaded documents
CREATE TABLE public.service_app_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.service_applications(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  file_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | uploaded | verified | rejected
  notes TEXT,
  requested_by UUID REFERENCES auth.users(id),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_app_documents TO authenticated;
GRANT ALL ON public.service_app_documents TO service_role;
ALTER TABLE public.service_app_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Docs: citizen own" ON public.service_app_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_applications a WHERE a.id = application_id AND a.citizen_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.service_applications a WHERE a.id = application_id AND a.citizen_id = auth.uid()));

CREATE POLICY "Docs: officer assigned" ON public.service_app_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_applications a WHERE a.id = application_id AND a.assigned_officer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.service_applications a WHERE a.id = application_id AND a.assigned_officer_id = auth.uid()));

CREATE POLICY "Docs: admin/authority" ON public.service_app_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'government_authority'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'government_authority'));

CREATE TRIGGER service_app_documents_touch
  BEFORE UPDATE ON public.service_app_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Timeline
CREATE TABLE public.service_app_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.service_applications(id) ON DELETE CASCADE,
  status public.service_app_status NOT NULL,
  remarks TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.service_app_timeline TO authenticated;
GRANT ALL ON public.service_app_timeline TO service_role;
ALTER TABLE public.service_app_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Timeline visible to participants" ON public.service_app_timeline FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.service_applications a WHERE a.id = application_id
            AND (a.citizen_id = auth.uid() OR a.assigned_officer_id = auth.uid()))
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'government_authority')
  );

CREATE POLICY "Timeline insert by participants" ON public.service_app_timeline FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.service_applications a WHERE a.id = application_id
            AND (a.citizen_id = auth.uid() OR a.assigned_officer_id = auth.uid()))
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'government_authority')
  );


-- === 20260612173804_0efcf7f0-99c8-4e0d-923d-674da0e9bc69.sql ===

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


-- === 20260614171830_461f91de-4338-496e-8bf6-ea2eb37a419f.sql ===

-- 1) Harden new-user trigger: never auto-promote to admin/officer/government_authority via signup metadata.
--    The only role granted on signup is 'citizen'. Privileged roles are granted server-side after verification.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_intended text;
  v_active boolean := true;
BEGIN
  v_intended := COALESCE(NEW.raw_user_meta_data->>'intended_role', 'citizen');

  -- Admins must be approved by Government Authority before becoming active.
  IF v_intended = 'admin' THEN
    v_active := false;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, mobile_number, active_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'mobile_number',
    v_active
  ) ON CONFLICT (id) DO NOTHING;

  -- Always assign 'citizen' on signup. Real role is granted later by:
  --   - Government Authority approval (admin)
  --   - Admin creating officer (officer)
  --   - Bootstrap/seed (government_authority)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'citizen')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 2) Backfill: demote orphan admins (admin role with no admin_registrations row) to citizen + inactive.
WITH orphans AS (
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
    AND NOT EXISTS (
      SELECT 1 FROM public.admin_registrations ar
      WHERE ar.user_id = ur.user_id
    )
)
DELETE FROM public.user_roles
WHERE role = 'admin' AND user_id IN (SELECT user_id FROM orphans);

INSERT INTO public.user_roles (user_id, role)
SELECT ur.user_id, 'citizen'
FROM public.profiles p
JOIN (
  SELECT id AS user_id FROM public.profiles
) ur ON ur.user_id = p.id
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles x WHERE x.user_id = p.id)
ON CONFLICT DO NOTHING;

-- 3) Backfill: any admin whose registration is not approved should be inactive.
UPDATE public.profiles p
SET active_status = false
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin'
)
AND NOT EXISTS (
  SELECT 1 FROM public.admin_registrations ar
  WHERE ar.user_id = p.id AND ar.verification_status = 'approved'
);


-- === 20260615082715_c72c3373-9550-4662-ae48-e973bb605f7c.sql ===

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


-- === 20260616073156_e5b5dc00-da17-48be-9f11-6e2fce89b68e.sql ===
ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id);

CREATE POLICY "gov authority updates audit logs"
  ON public.audit_logs FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'government_authority'::app_role))
  WITH CHECK (has_role(auth.uid(), 'government_authority'::app_role));

-- === 20260616080142_c342f53e-90f6-49fd-8edd-22f82f7cd817.sql ===
CREATE POLICY "citizens read assigned officer profile" ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.complaints c WHERE c.assigned_officer_id = profiles.id AND c.citizen_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.service_applications s WHERE s.assigned_officer_id = profiles.id AND s.citizen_id = auth.uid())
);
