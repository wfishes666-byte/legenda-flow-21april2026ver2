-- Tabel permintaan reset password (admin-driven flow)
CREATE TABLE public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending', -- pending | link_generated | completed | rejected
  reset_link text,
  link_expires_at timestamptz,
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pwd_reset_status ON public.password_reset_requests(status, created_at DESC);

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Public (siapa pun, termasuk yang belum login) boleh insert request
CREATE POLICY "Anyone can request password reset"
ON public.password_reset_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Admin & management lihat & kelola semua
CREATE POLICY "Admin full access password resets"
ON public.password_reset_requests
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Management manage password resets"
ON public.password_reset_requests
FOR ALL
USING (public.has_role(auth.uid(), 'management'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'management'::public.app_role));

-- Trigger update_at
CREATE TRIGGER trg_pwd_reset_updated_at
BEFORE UPDATE ON public.password_reset_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: setiap request masuk → catat ke activity_logs sebagai notif merah untuk admin
CREATE OR REPLACE FUNCTION public.notify_password_reset_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid;
BEGIN
  -- Ambil 1 admin sebagai placeholder owner row activity_logs (RLS butuh user_id valid)
  SELECT user_id INTO v_admin FROM public.user_roles WHERE role = 'admin'::app_role LIMIT 1;
  IF v_admin IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.activity_logs (user_id, user_name, user_role, module, action, description, metadata)
  VALUES (
    v_admin,
    COALESCE(NULLIF(NEW.full_name, ''), NEW.email),
    'guest',
    'Auth',
    'Permintaan Reset Password',
    'User meminta reset password: ' || NEW.email,
    jsonb_build_object(
      'request_id', NEW.id,
      'email', NEW.email,
      'severity', 'high',
      'kind', 'password_reset_request'
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_pwd_reset
AFTER INSERT ON public.password_reset_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_password_reset_request();