ALTER TABLE public.outlet_finance_configs
  ADD COLUMN IF NOT EXISTS pair_groups jsonb NOT NULL DEFAULT '[]'::jsonb;