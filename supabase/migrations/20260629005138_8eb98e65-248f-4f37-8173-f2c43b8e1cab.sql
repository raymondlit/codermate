
-- Add invite code to classes for student self-join
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

-- Backfill existing rows
UPDATE public.classes
  SET invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  WHERE invite_code IS NULL;

ALTER TABLE public.classes
  ALTER COLUMN invite_code SET NOT NULL,
  ALTER COLUMN invite_code SET DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

-- Allow a student to read a class row when joining by code (limited)
-- Existing policy already lets teacher/super_admin manage; add SELECT for members
DROP POLICY IF EXISTS "Members can view their class" ON public.classes;
CREATE POLICY "Members can view their class"
  ON public.classes
  FOR SELECT
  USING (
    auth.uid() = teacher_id
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.class_members m
      WHERE m.class_id = classes.id AND m.student_id = auth.uid()
    )
  );

-- SECURITY DEFINER join function: a logged-in student joins by invite code
CREATE OR REPLACE FUNCTION public.join_class_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id uuid;
  v_teacher uuid;
  v_max int;
  v_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  SELECT id, teacher_id INTO v_class_id, v_teacher
    FROM public.classes WHERE invite_code = upper(_code);
  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  SELECT max_class_size INTO v_max FROM public.teacher_settings WHERE teacher_id = v_teacher;
  IF v_max IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.class_members WHERE class_id = v_class_id;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'Class is full';
    END IF;
  END IF;

  INSERT INTO public.class_members (class_id, student_id)
    VALUES (v_class_id, auth.uid())
    ON CONFLICT DO NOTHING;

  RETURN v_class_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_class_by_code(text) TO authenticated;
