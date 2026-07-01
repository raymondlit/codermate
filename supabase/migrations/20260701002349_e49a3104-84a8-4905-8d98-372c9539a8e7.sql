
DROP FUNCTION IF EXISTS public.bulk_upsert_classes_with_roster(jsonb);

CREATE FUNCTION public.bulk_upsert_classes_with_roster(_payload jsonb)
 RETURNS TABLE(out_class_id uuid, out_class_name text, out_inserted_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_is_super boolean;
  v_item jsonb;
  v_class_id uuid;
  v_class_name text;
  v_desc text;
  v_student jsonb;
  v_inserted int;
  v_no text;
  v_name text;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  v_is_super := public.has_role(v_caller, 'super_admin');
  IF NOT (v_is_super OR public.has_role(v_caller, 'teacher')) THEN
    RAISE EXCEPTION 'Only teacher or super admin can import classes';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_payload) LOOP
    v_class_name := trim(v_item->>'class_name');
    v_desc := NULLIF(trim(coalesce(v_item->>'description','')), '');
    IF v_class_name IS NULL OR v_class_name = '' THEN CONTINUE; END IF;

    SELECT id INTO v_class_id FROM public.classes
      WHERE teacher_id = v_caller AND name = v_class_name LIMIT 1;
    IF v_class_id IS NULL THEN
      INSERT INTO public.classes (teacher_id, name, description)
        VALUES (v_caller, v_class_name, v_desc) RETURNING id INTO v_class_id;
    END IF;

    v_inserted := 0;
    FOR v_student IN SELECT * FROM jsonb_array_elements(coalesce(v_item->'students','[]'::jsonb)) LOOP
      v_name := trim(v_student->>'student_name');
      v_no := NULLIF(trim(coalesce(v_student->>'student_no','')), '');
      IF v_name IS NULL OR v_name = '' THEN CONTINUE; END IF;

      IF v_no IS NULL THEN
        INSERT INTO public.class_roster (class_id, student_no, student_name)
          VALUES (v_class_id, NULL, v_name);
      ELSE
        UPDATE public.class_roster r SET student_name = v_name
         WHERE r.class_id = v_class_id AND r.student_no = v_no;
        IF NOT FOUND THEN
          INSERT INTO public.class_roster (class_id, student_no, student_name)
            VALUES (v_class_id, v_no, v_name);
        END IF;
      END IF;
      v_inserted := v_inserted + 1;
    END LOOP;

    out_class_id := v_class_id;
    out_class_name := v_class_name;
    out_inserted_count := v_inserted;
    RETURN NEXT;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.bulk_upsert_classes_with_roster(jsonb) TO authenticated;
