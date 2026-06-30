GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.join_class_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_upsert_classes_with_roster(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_teacher(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_teacher(uuid, text) TO authenticated;