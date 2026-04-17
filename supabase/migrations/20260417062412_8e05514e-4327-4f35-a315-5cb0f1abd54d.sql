ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS late_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cashbon_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashbon_notes text NOT NULL DEFAULT '';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_outlet_date ON public.attendance(outlet_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_profiles_outlet ON public.profiles(outlet_id);