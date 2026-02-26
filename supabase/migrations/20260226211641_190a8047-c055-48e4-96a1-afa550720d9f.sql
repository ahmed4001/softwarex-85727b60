
-- Drop redundant vendor_review_responses table (vendor_responses already exists)
DROP TRIGGER IF EXISTS update_vendor_review_responses_updated_at ON public.vendor_review_responses;
DROP TABLE IF EXISTS public.vendor_review_responses;
