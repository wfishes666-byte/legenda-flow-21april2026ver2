-- 1. Add geofence columns to outlets
ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS radius_meters integer DEFAULT 100;

-- Allow management to update outlets (was missing)
DROP POLICY IF EXISTS "Management can update outlets" ON public.outlets;
CREATE POLICY "Management can update outlets"
  ON public.outlets FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role));

-- 2. Create attendance_logs table (selfie-based check-in/out, multiple per day)
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  log_type text NOT NULL DEFAULT 'check_in', -- 'check_in' | 'check_out'
  selfie_url text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  accuracy_meters numeric,
  distance_from_outlet_meters numeric,
  out_of_radius boolean NOT NULL DEFAULT false,
  device_info text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_date ON public.attendance_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_outlet_date ON public.attendance_logs (outlet_id, created_at DESC);

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own attendance logs"
  ON public.attendance_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own attendance logs"
  ON public.attendance_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Management view all attendance logs"
  ON public.attendance_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "PIC view all attendance logs"
  ON public.attendance_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'pic'::app_role));

CREATE POLICY "Management full manage attendance logs"
  ON public.attendance_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

-- 3. Create public storage bucket for selfies
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-selfies', 'attendance-selfies', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users upload to their own folder, everyone authenticated can view
CREATE POLICY "Selfies are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attendance-selfies');

CREATE POLICY "Users upload own selfies"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attendance-selfies'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own selfies"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'attendance-selfies'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );