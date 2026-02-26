
-- Vendor Review Responses: allow vendors to officially respond to reviews
CREATE TABLE public.vendor_review_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  vendor_user_id UUID NOT NULL,
  body TEXT NOT NULL,
  is_official BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(review_id)
);

ALTER TABLE public.vendor_review_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Responses are publicly readable"
  ON public.vendor_review_responses FOR SELECT USING (true);

CREATE POLICY "Vendors can create responses for claimed products"
  ON public.vendor_review_responses FOR INSERT
  WITH CHECK (
    auth.uid() = vendor_user_id
    AND EXISTS (
      SELECT 1 FROM reviews r
      JOIN product_claims pc ON pc.product_id = r.product_id
      WHERE r.id = review_id
        AND pc.user_id = auth.uid()
        AND pc.status = 'approved'
    )
  );

CREATE POLICY "Vendors can update own responses"
  ON public.vendor_review_responses FOR UPDATE
  USING (auth.uid() = vendor_user_id);

CREATE POLICY "Vendors can delete own responses"
  ON public.vendor_review_responses FOR DELETE
  USING (auth.uid() = vendor_user_id);

CREATE POLICY "Admins can manage responses"
  ON public.vendor_review_responses FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin'));

-- Moderation queue table for flagged content
CREATE TABLE public.moderation_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type TEXT NOT NULL, -- 'review', 'discussion', 'reply', 'product_submission'
  content_id UUID NOT NULL,
  reason TEXT NOT NULL DEFAULT 'flagged', -- 'flagged', 'spam', 'inappropriate', 'auto_detected'
  reported_by UUID, -- null for auto-detected
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'escalated'
  moderator_id UUID,
  moderator_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage moderation queue"
  ON public.moderation_queue FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Users can report content"
  ON public.moderation_queue FOR INSERT
  WITH CHECK (auth.uid() = reported_by);

-- Trigger to auto-update updated_at on vendor_review_responses
CREATE TRIGGER update_vendor_review_responses_updated_at
  BEFORE UPDATE ON public.vendor_review_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
