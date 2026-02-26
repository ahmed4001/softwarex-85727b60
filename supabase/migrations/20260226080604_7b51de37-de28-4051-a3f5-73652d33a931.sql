
-- Table: lists
CREATE TABLE public.lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  cover_image text,
  is_published boolean NOT NULL DEFAULT true,
  upvote_count integer NOT NULL DEFAULT 0,
  product_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: list_items
CREATE TABLE public.list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(list_id, product_id)
);

-- Table: list_votes
CREATE TABLE public.list_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(list_id, user_id)
);

-- Enable RLS
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_votes ENABLE ROW LEVEL SECURITY;

-- lists RLS
CREATE POLICY "Published lists are publicly readable"
  ON public.lists FOR SELECT USING (is_published = true);

CREATE POLICY "Users can create lists"
  ON public.lists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update own lists"
  ON public.lists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete own lists"
  ON public.lists FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can read own unpublished lists"
  ON public.lists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage lists"
  ON public.lists FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- list_items RLS
CREATE POLICY "List items are publicly readable via published list"
  ON public.list_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.lists WHERE lists.id = list_items.list_id AND lists.is_published = true));

CREATE POLICY "Owner can read own list items"
  ON public.list_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.lists WHERE lists.id = list_items.list_id AND lists.user_id = auth.uid()));

CREATE POLICY "Owner can insert list items"
  ON public.list_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.lists WHERE lists.id = list_items.list_id AND lists.user_id = auth.uid()));

CREATE POLICY "Owner can update list items"
  ON public.list_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.lists WHERE lists.id = list_items.list_id AND lists.user_id = auth.uid()));

CREATE POLICY "Owner can delete list items"
  ON public.list_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.lists WHERE lists.id = list_items.list_id AND lists.user_id = auth.uid()));

CREATE POLICY "Admins can manage list items"
  ON public.list_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- list_votes RLS
CREATE POLICY "List votes are publicly readable"
  ON public.list_votes FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own votes"
  ON public.list_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes"
  ON public.list_votes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage list votes"
  ON public.list_votes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Trigger for updated_at on lists
CREATE TRIGGER update_lists_updated_at
  BEFORE UPDATE ON public.lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
