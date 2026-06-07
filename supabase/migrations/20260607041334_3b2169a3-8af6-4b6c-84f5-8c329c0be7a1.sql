-- Add INSERT policy so authenticated users can create their own subscription
CREATE POLICY "Users can insert their own subscription"
ON public.vendor_subscriptions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Drop and recreate UPDATE policy with both USING and WITH CHECK
DROP POLICY IF EXISTS "Owners can update own subscription" ON public.vendor_subscriptions;

CREATE POLICY "Users can update their own subscription"
ON public.vendor_subscriptions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);