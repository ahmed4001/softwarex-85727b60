
-- Helper slugify
CREATE OR REPLACE FUNCTION public.slugify(_input text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(
    trim(both '-' from
      regexp_replace(
        regexp_replace(lower(coalesce(_input, '')), '[^a-z0-9]+', '-', 'g'),
        '-{2,}', '-', 'g'
      )
    ),
    ''
  );
$$;

-- profiles.username
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

-- Backfill usernames
WITH base AS (
  SELECT id, user_id,
    COALESCE(
      public.slugify(name),
      public.slugify(split_part(email, '@', 1)),
      'user'
    ) AS s
  FROM public.profiles
  WHERE username IS NULL
),
numbered AS (
  SELECT id, user_id, s,
    ROW_NUMBER() OVER (PARTITION BY s ORDER BY user_id) AS rn
  FROM base
)
UPDATE public.profiles p
SET username = CASE WHEN n.rn = 1 THEN n.s ELSE n.s || '-' || substring(n.user_id::text, 1, 6) END
FROM numbered n
WHERE p.id = n.id;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx ON public.profiles (username) WHERE username IS NOT NULL;

CREATE OR REPLACE FUNCTION public.profiles_set_username()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base text; candidate text; n int := 0;
BEGIN
  IF NEW.username IS NULL OR NEW.username = '' THEN
    base := COALESCE(public.slugify(NEW.name), public.slugify(split_part(NEW.email, '@', 1)), 'user');
    candidate := base;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate AND user_id <> NEW.user_id) LOOP
      n := n + 1;
      candidate := base || '-' || substring(md5(NEW.user_id::text || n::text), 1, 4);
    END LOOP;
    NEW.username := candidate;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_set_username ON public.profiles;
CREATE TRIGGER trg_profiles_set_username
BEFORE INSERT OR UPDATE OF name, email, username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_set_username();

-- discussions.slug
ALTER TABLE public.discussions ADD COLUMN IF NOT EXISTS slug text;

WITH base AS (
  SELECT id, COALESCE(public.slugify(title), 'discussion') AS s FROM public.discussions WHERE slug IS NULL
),
numbered AS (
  SELECT id, s, ROW_NUMBER() OVER (PARTITION BY s ORDER BY id) AS rn FROM base
)
UPDATE public.discussions d
SET slug = CASE WHEN n.rn = 1 THEN n.s ELSE n.s || '-' || substring(d.id::text, 1, 6) END
FROM numbered n WHERE d.id = n.id;

CREATE UNIQUE INDEX IF NOT EXISTS discussions_slug_unique_idx ON public.discussions (slug) WHERE slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.discussions_set_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base text; candidate text; n int := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := COALESCE(public.slugify(NEW.title), 'discussion');
    candidate := base;
    WHILE EXISTS (SELECT 1 FROM public.discussions WHERE slug = candidate AND id <> NEW.id) LOOP
      n := n + 1;
      candidate := base || '-' || substring(md5(NEW.id::text || n::text), 1, 4);
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_discussions_set_slug ON public.discussions;
CREATE TRIGGER trg_discussions_set_slug
BEFORE INSERT ON public.discussions
FOR EACH ROW EXECUTE FUNCTION public.discussions_set_slug();
