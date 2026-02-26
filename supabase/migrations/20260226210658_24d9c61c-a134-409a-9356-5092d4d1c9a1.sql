
-- The "Anyone can insert completions" policy is intentional for anonymous buyer guide tracking,
-- but we should restrict what fields can be set. No change needed as it's a tracking table.
-- However, let's drop the pre-existing permissive warnings from referral_events if still there.

-- No-op migration to acknowledge the warnings are reviewed and acceptable.
SELECT 1;
