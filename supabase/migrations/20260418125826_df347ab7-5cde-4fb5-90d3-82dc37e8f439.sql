-- 1) Custom roles table (dynamic role definitions, separate from app_role enum)
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view custom roles"
ON public.custom_roles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin manage custom roles"
ON public.custom_roles FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE TRIGGER trg_custom_roles_updated_at
BEFORE UPDATE ON public.custom_roles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Add CRUD permission columns + role_code (for custom roles)
ALTER TABLE public.role_menu_permissions
  ADD COLUMN IF NOT EXISTS role_code TEXT,
  ADD COLUMN IF NOT EXISTS can_create BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_delete BOOLEAN NOT NULL DEFAULT false;

-- 3) Make existing 'role' column nullable so a row can target either an enum role OR a custom role
ALTER TABLE public.role_menu_permissions
  ALTER COLUMN role DROP NOT NULL;

-- Ensure exactly one of (role, role_code) is set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'role_menu_permissions_role_xor'
  ) THEN
    ALTER TABLE public.role_menu_permissions
      ADD CONSTRAINT role_menu_permissions_role_xor
      CHECK ((role IS NOT NULL)::int + (role_code IS NOT NULL)::int = 1);
  END IF;
END$$;

-- Unique index per (role, menu_key) and per (role_code, menu_key)
CREATE UNIQUE INDEX IF NOT EXISTS uq_rmp_role_menu
  ON public.role_menu_permissions(role, menu_key) WHERE role IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_rmp_role_code_menu
  ON public.role_menu_permissions(role_code, menu_key) WHERE role_code IS NOT NULL;