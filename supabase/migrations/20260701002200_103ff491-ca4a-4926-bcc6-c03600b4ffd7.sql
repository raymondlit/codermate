
CREATE OR REPLACE FUNCTION public.is_class_teacher(_user uuid, _class uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = _class AND c.teacher_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.is_class_member(_user uuid, _class uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.class_members m WHERE m.class_id = _class AND m.student_id = _user);
$$;

GRANT EXECUTE ON FUNCTION public.is_class_teacher(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid, uuid) TO authenticated;

-- classes: drop recursive policies, recreate using helpers
DROP POLICY IF EXISTS "Members can view their class" ON public.classes;
DROP POLICY IF EXISTS "Teacher manages own classes" ON public.classes;

CREATE POLICY "Class read access"
  ON public.classes FOR SELECT
  TO authenticated
  USING (
    auth.uid() = teacher_id
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_class_member(auth.uid(), id)
  );

CREATE POLICY "Teacher manages own classes"
  ON public.classes FOR ALL
  TO authenticated
  USING (auth.uid() = teacher_id OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (auth.uid() = teacher_id OR public.has_role(auth.uid(), 'super_admin'));

-- class_members: drop recursive policies, recreate using helpers
DROP POLICY IF EXISTS "Class members visibility" ON public.class_members;
DROP POLICY IF EXISTS "Teacher manages class members" ON public.class_members;

CREATE POLICY "Class members read"
  ON public.class_members FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_class_teacher(auth.uid(), class_id)
  );

CREATE POLICY "Teacher manages class members"
  ON public.class_members FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.is_class_teacher(auth.uid(), class_id))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.is_class_teacher(auth.uid(), class_id));
