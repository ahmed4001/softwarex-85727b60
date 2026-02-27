-- Add verification fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS verification_type text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS verified_domain text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone DEFAULT NULL;

-- verification_type can be: 'email_domain', 'linkedin', 'manual'
-- verified_domain stores the email domain (e.g. 'google.com') for domain-verified users

COMMENT ON COLUMN public.profiles.verification_type IS 'Type of verification: email_domain, linkedin, or manual';
COMMENT ON COLUMN public.profiles.verified_domain IS 'Email domain used for verification (e.g. company.com)';
COMMENT ON COLUMN public.profiles.verified_at IS 'When the user was verified';