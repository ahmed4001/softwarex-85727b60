
-- Create saved_products table for wishlists/bookmarks
CREATE TABLE public.saved_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Enable RLS
ALTER TABLE public.saved_products ENABLE ROW LEVEL SECURITY;

-- Users can view their own saved products
CREATE POLICY "Users can view own saved products"
  ON public.saved_products FOR SELECT
  USING (auth.uid() = user_id);

-- Users can save products
CREATE POLICY "Users can save products"
  ON public.saved_products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unsave products
CREATE POLICY "Users can unsave products"
  ON public.saved_products FOR DELETE
  USING (auth.uid() = user_id);
