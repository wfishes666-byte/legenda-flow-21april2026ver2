ALTER TABLE public.password_reset_requests
ADD COLUMN IF NOT EXISTS resolution_notes text NOT NULL DEFAULT '';