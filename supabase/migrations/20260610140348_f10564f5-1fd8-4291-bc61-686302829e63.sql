CREATE TABLE IF NOT EXISTS public.paddle_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  user_id uuid,
  plan text,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.paddle_webhook_events TO service_role;
ALTER TABLE public.paddle_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.paddle_webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);