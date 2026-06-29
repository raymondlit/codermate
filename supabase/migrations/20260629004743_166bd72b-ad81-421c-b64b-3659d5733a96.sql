
-- =========================================================
-- Teacher applications: pending approval queue
-- =========================================================
CREATE TABLE IF NOT EXISTS public.teacher_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text,
  display_name text,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_applications TO authenticated;
GRANT ALL ON public.teacher_applications TO service_role;
ALTER TABLE public.teacher_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own application"
  ON public.teacher_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin manages applications"
  ON public.teacher_applications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_teacher_applications_touch
  BEFORE UPDATE ON public.teacher_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- Teacher settings: per-teacher capability + AI quota
-- =========================================================
CREATE TABLE IF NOT EXISTS public.teacher_settings (
  teacher_id uuid PRIMARY KEY,
  can_create_class boolean NOT NULL DEFAULT true,
  max_class_size integer NOT NULL DEFAULT 50,
  can_view_student_answers boolean NOT NULL DEFAULT true,
  ai_quota_tokens integer NOT NULL DEFAULT 100000,
  ai_used_tokens integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_settings TO authenticated;
GRANT ALL ON public.teacher_settings TO service_role;
ALTER TABLE public.teacher_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teacher reads own settings"
  ON public.teacher_settings FOR SELECT TO authenticated
  USING (auth.uid() = teacher_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin manages teacher settings"
  ON public.teacher_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_teacher_settings_touch
  BEFORE UPDATE ON public.teacher_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- Classes
-- =========================================================
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teacher manages own classes"
  ON public.classes FOR ALL TO authenticated
  USING (auth.uid() = teacher_id OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (auth.uid() = teacher_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_classes_touch
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.class_members (
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_members TO authenticated;
GRANT ALL ON public.class_members TO service_role;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Class members visibility"
  ON public.class_members FOR SELECT TO authenticated
  USING (
    auth.uid() = student_id
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.teacher_id = auth.uid())
  );

CREATE POLICY "Teacher manages class members"
  ON public.class_members FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.teacher_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.teacher_id = auth.uid())
  );

-- =========================================================
-- Update handle_new_user: teachers go through approval queue
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  desired_role text;
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  desired_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');

  -- Always seed a student baseline so the account is usable while pending
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;

  IF desired_role = 'teacher' THEN
    INSERT INTO public.teacher_applications (user_id, email, display_name, status)
    VALUES (NEW.id, NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
            'pending')
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF desired_role IN ('super_admin', 'admin') THEN
    -- never auto-grant elevated roles via signup metadata
    NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- Helper: approve teacher (grants role, creates default settings)
-- =========================================================
CREATE OR REPLACE FUNCTION public.approve_teacher(_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_user_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admin can approve teachers';
  END IF;

  SELECT user_id INTO app_user_id FROM public.teacher_applications WHERE id = _application_id;
  IF app_user_id IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  UPDATE public.teacher_applications
    SET status = 'approved', decided_by = auth.uid(), decided_at = now()
    WHERE id = _application_id;

  INSERT INTO public.user_roles (user_id, role)
    VALUES (app_user_id, 'teacher')
    ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.teacher_settings (teacher_id)
    VALUES (app_user_id)
    ON CONFLICT (teacher_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_teacher(_application_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admin can reject teachers';
  END IF;
  UPDATE public.teacher_applications
    SET status = 'rejected', note = _note, decided_by = auth.uid(), decided_at = now()
    WHERE id = _application_id;
END;
$$;

-- =========================================================
-- Seed super admin user: icelm@sina.com
-- =========================================================
DO $$
DECLARE
  new_uid uuid;
BEGIN
  SELECT id INTO new_uid FROM auth.users WHERE email = 'icelm@sina.com';
  IF new_uid IS NULL THEN
    new_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_uid,
      'authenticated','authenticated',
      'icelm@sina.com',
      crypt('65928088Lit', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"超级管理员"}'::jsonb,
      false, '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), new_uid,
            jsonb_build_object('sub', new_uid::text, 'email', 'icelm@sina.com'),
            'email', new_uid::text, now(), now(), now());
  END IF;

  INSERT INTO public.profiles (id, display_name)
    VALUES (new_uid, '超级管理员')
    ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

  -- Grant super_admin role (and remove auto-seeded student role if present)
  INSERT INTO public.user_roles (user_id, role)
    VALUES (new_uid, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
END $$;
