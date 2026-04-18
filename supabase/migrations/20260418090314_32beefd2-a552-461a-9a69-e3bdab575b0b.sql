-- Allow anonymous users to view outlets (needed for signup branch selector)
DROP POLICY IF EXISTS "Authenticated users can view outlets" ON public.outlets;

CREATE POLICY "Anyone can view outlets"
ON public.outlets
FOR SELECT
TO anon, authenticated
USING (true);