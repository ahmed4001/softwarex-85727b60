
-- Review media attachments table
CREATE TABLE public.review_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  url text NOT NULL,
  file_type text,
  file_size integer,
  alt_text text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.review_media ENABLE ROW LEVEL SECURITY;

-- Public can view media for approved reviews
CREATE POLICY "Review media is publicly readable"
  ON public.review_media FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.reviews WHERE reviews.id = review_media.review_id AND reviews.status = 'approved'));

-- Users can insert media for their own reviews
CREATE POLICY "Users can upload review media"
  ON public.review_media FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete own media
CREATE POLICY "Users can delete own review media"
  ON public.review_media FOR DELETE
  USING (auth.uid() = user_id);

-- Admins full access
CREATE POLICY "Admins can manage review media"
  ON public.review_media FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Storage bucket for review media
INSERT INTO storage.buckets (id, name, public) VALUES ('review-media', 'review-media', true);

-- Storage policies
CREATE POLICY "Review media files are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'review-media');

CREATE POLICY "Authenticated users can upload review media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'review-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own review media files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'review-media' AND auth.uid()::text = (storage.foldername(name))[1]);
