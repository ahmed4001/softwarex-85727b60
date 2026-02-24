
-- Function to get the best available Brevo account (most remaining credits)
CREATE OR REPLACE FUNCTION public.get_best_brevo_account()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  best_id uuid;
BEGIN
  -- First reset credits for accounts where reset is overdue (24h)
  UPDATE brevo_accounts
  SET credits_used_today = 0, credits_reset_at = now()
  WHERE credits_reset_at < now() - interval '24 hours';

  -- Pick active account with most remaining credits
  SELECT id INTO best_id
  FROM brevo_accounts
  WHERE is_active = true
    AND credits_used_today < COALESCE(daily_credit_limit, 300)
  ORDER BY (COALESCE(daily_credit_limit, 300) - COALESCE(credits_used_today, 0)) DESC
  LIMIT 1;

  RETURN best_id;
END;
$$;

-- Function to reset daily credits for all accounts
CREATE OR REPLACE FUNCTION public.reset_brevo_daily_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE brevo_accounts
  SET credits_used_today = 0, credits_reset_at = now()
  WHERE credits_reset_at < now() - interval '24 hours';
END;
$$;
