ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS nik TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS join_date DATE;

-- Update handle_new_user agar ikut menyimpan field signup tambahan dari raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_join_date date := NULL;
BEGIN
  IF (meta->>'join_year') IS NOT NULL AND (meta->>'join_month') IS NOT NULL THEN
    BEGIN
      v_join_date := make_date((meta->>'join_year')::int, (meta->>'join_month')::int, 1);
    EXCEPTION WHEN OTHERS THEN
      v_join_date := NULL;
    END;
  END IF;

  INSERT INTO public.profiles (
    user_id, full_name, nickname, address, phone, nik,
    outlet_id, join_date
  )
  VALUES (
    NEW.id,
    COALESCE(meta->>'full_name', ''),
    COALESCE(meta->>'nickname', ''),
    COALESCE(meta->>'address', ''),
    COALESCE(meta->>'phone', ''),
    COALESCE(meta->>'nik', ''),
    NULLIF(meta->>'outlet_id', '')::uuid,
    v_join_date
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    nickname  = COALESCE(NULLIF(EXCLUDED.nickname,  ''), public.profiles.nickname),
    address   = COALESCE(NULLIF(EXCLUDED.address,   ''), public.profiles.address),
    phone     = COALESCE(NULLIF(EXCLUDED.phone,     ''), public.profiles.phone),
    nik       = COALESCE(NULLIF(EXCLUDED.nik,       ''), public.profiles.nik),
    outlet_id = COALESCE(EXCLUDED.outlet_id, public.profiles.outlet_id),
    join_date = COALESCE(EXCLUDED.join_date, public.profiles.join_date);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'staff')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Pastikan trigger on_auth_user_created ada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Pastikan user_id unik di profiles agar ON CONFLICT bekerja
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='profiles_user_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
    END;
  END IF;
END $$;