-- Activity logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  user_role text NOT NULL DEFAULT '',
  module text NOT NULL DEFAULT '',
  action text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON public.activity_logs (module);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Only management can view all logs
CREATE POLICY "Management can view all activity logs"
  ON public.activity_logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'management'::app_role));

-- Any authenticated user can insert their own log entries
CREATE POLICY "Users can insert own activity log"
  ON public.activity_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Management full access
CREATE POLICY "Management full access activity logs"
  ON public.activity_logs
  FOR ALL
  USING (public.has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'management'::app_role));