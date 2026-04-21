CREATE TABLE IF NOT EXISTS public.outlet_finance_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL UNIQUE REFERENCES public.outlets(id) ON DELETE CASCADE,
  income_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  selisih_formula text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outlet_finance_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access outlet_finance_configs" ON public.outlet_finance_configs;
CREATE POLICY "Admin full access outlet_finance_configs"
  ON public.outlet_finance_configs FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Management manage outlet_finance_configs" ON public.outlet_finance_configs;
CREATE POLICY "Management manage outlet_finance_configs"
  ON public.outlet_finance_configs FOR ALL
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

DROP POLICY IF EXISTS "Authenticated view outlet_finance_configs" ON public.outlet_finance_configs;
CREATE POLICY "Authenticated view outlet_finance_configs"
  ON public.outlet_finance_configs FOR SELECT
  TO authenticated USING (true);

DROP TRIGGER IF EXISTS set_updated_at_outlet_finance_configs ON public.outlet_finance_configs;
CREATE TRIGGER set_updated_at_outlet_finance_configs
  BEFORE UPDATE ON public.outlet_finance_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();