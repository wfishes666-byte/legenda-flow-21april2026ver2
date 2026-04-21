ALTER TABLE public.outlet_finance_configs
  ADD COLUMN IF NOT EXISTS selisih_inline_label text NOT NULL DEFAULT '';