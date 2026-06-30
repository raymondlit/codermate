
CREATE TABLE public.class_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_no text,
  student_name text NOT NULL,
  linked_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX class_roster_class_no_uniq ON public.class_roster(class_id, student_no) WHERE student_no IS NOT NULL;
CREATE INDEX class_roster_class_idx ON public.class_roster(class_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_roster TO authenticated;
GRANT ALL ON public.class_roster TO service_role;

ALTER TABLE public.class_roster ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teacher manages roster"
  ON public.class_roster
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_roster.class_id AND c.teacher_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_roster.class_id AND c.teacher_id = auth.uid())
  );

CREATE POLICY "Student views own class roster"
  ON public.class_roster FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.class_members m WHERE m.class_id = class_roster.class_id AND m.student_id = auth.uid())
  );

-- Bulk import: input JSON shape: [{"class_name":"机制B250201","description":null,"students":[{"student_no":"...","student_name":"..."}, ...]}, ...]
CREATE OR REPLACE FUNCTION public.bulk_upsert_classes_with_roster(_payload jsonb)
RETURNS TABLE(class_id uuid, class_name text, inserted_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_super boolean;
  v_item jsonb;
  v_class_id uuid;
  v_class_name text;
  v_desc text;
  v_student jsonb;
  v_inserted int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  v_is_super := public.has_role(v_caller, 'super_admin');
  IF NOT (v_is_super OR public.has_role(v_caller, 'teacher')) THEN
    RAISE EXCEPTION 'Only teacher or super admin can import classes';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_payload)
  LOOP
    v_class_name := trim(v_item->>'class_name');
    v_desc := NULLIF(trim(coalesce(v_item->>'description','')), '');
    IF v_class_name IS NULL OR v_class_name = '' THEN
      CONTINUE;
    END IF;

    -- find existing class owned by caller with same name, else create
    SELECT id INTO v_class_id
      FROM public.classes
      WHERE teacher_id = v_caller AND name = v_class_name
      LIMIT 1;

    IF v_class_id IS NULL THEN
      INSERT INTO public.classes (teacher_id, name, description)
        VALUES (v_caller, v_class_name, v_desc)
        RETURNING id INTO v_class_id;
    END IF;

    v_inserted := 0;
    FOR v_student IN SELECT * FROM jsonb_array_elements(coalesce(v_item->'students','[]'::jsonb))
    LOOP
      IF coalesce(trim(v_student->>'student_name'),'') = '' THEN
        CONTINUE;
      END IF;
      BEGIN
        INSERT INTO public.class_roster (class_id, student_no, student_name)
          VALUES (
            v_class_id,
            NULLIF(trim(v_student->>'student_no'), ''),
            trim(v_student->>'student_name')
          )
          ON CONFLICT (class_id, student_no) WHERE student_no IS NOT NULL
          DO UPDATE SET student_name = EXCLUDED.student_name;
        v_inserted := v_inserted + 1;
      EXCEPTION WHEN OTHERS THEN
        -- ignore individual row errors
        NULL;
      END;
    END LOOP;

    class_id := v_class_id;
    class_name := v_class_name;
    inserted_count := v_inserted;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_upsert_classes_with_roster(jsonb) TO authenticated;
