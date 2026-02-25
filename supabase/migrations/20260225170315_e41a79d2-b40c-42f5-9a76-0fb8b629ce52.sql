
-- Fix: make the view use invoker's permissions (respects RLS)
ALTER VIEW public.active_comparisons SET (security_invoker = on);
