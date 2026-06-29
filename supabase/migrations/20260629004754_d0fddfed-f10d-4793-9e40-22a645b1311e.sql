
REVOKE ALL ON FUNCTION public.approve_teacher(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_teacher(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_teacher(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_teacher(uuid, text) TO authenticated;
