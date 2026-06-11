ALTER TABLE public.deals ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved';

-- Update any deals that might have been created without the default
UPDATE public.deals SET review_status = 'approved' WHERE review_status IS NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.deals.review_status IS 'pending_review, approved, or rejected';
