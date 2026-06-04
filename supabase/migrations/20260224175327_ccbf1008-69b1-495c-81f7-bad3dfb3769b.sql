
-- Brevo email marketing accounts table
CREATE TABLE public.brevo_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  api_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  daily_credit_limit integer DEFAULT 300,
  credits_used_today integer DEFAULT 0,
  credits_reset_at timestamp with time zone DEFAULT now(),
  total_emails_sent integer DEFAULT 0,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.brevo_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage brevo accounts"
ON public.brevo_accounts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Brevo email campaigns log
CREATE TABLE public.brevo_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brevo_account_id uuid REFERENCES public.brevo_accounts(id) ON DELETE CASCADE NOT NULL,
  brevo_campaign_id text,
  subject text NOT NULL,
  sender_name text NOT NULL DEFAULT 'ReviewHunts',
  sender_email text NOT NULL,
  html_content text,
  status text NOT NULL DEFAULT 'draft',
  recipients_count integer DEFAULT 0,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.brevo_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage brevo campaigns"
ON public.brevo_campaigns
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_brevo_accounts_updated_at
BEFORE UPDATE ON public.brevo_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_brevo_campaigns_updated_at
BEFORE UPDATE ON public.brevo_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
