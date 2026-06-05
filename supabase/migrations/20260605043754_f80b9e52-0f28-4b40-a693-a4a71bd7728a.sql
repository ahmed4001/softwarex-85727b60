ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS deals_product_id_idx ON public.deals(product_id);