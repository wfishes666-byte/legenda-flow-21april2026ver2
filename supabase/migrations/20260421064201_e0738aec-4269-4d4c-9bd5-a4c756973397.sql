-- 1. Restructure finance_daily_reports
ALTER TABLE public.finance_daily_reports
  DROP COLUMN IF EXISTS daily_offline_income,
  DROP COLUMN IF EXISTS online_delivery_sales,
  DROP COLUMN IF EXISTS shopeefood_sales,
  DROP COLUMN IF EXISTS gofood_sales,
  DROP COLUMN IF EXISTS grabfood_sales,
  DROP COLUMN IF EXISTS ending_physical_cash,
  DROP COLUMN IF EXISTS ending_qris_cash,
  DROP COLUMN IF EXISTS total_expense;

ALTER TABLE public.finance_daily_reports
  ADD COLUMN IF NOT EXISTS cash_on_hand_added numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_fields jsonb DEFAULT '{}'::jsonb;

-- Rename starting_cash -> cash_on_hand_start for clarity (keep starting_cash as alias by recreating)
-- Actually keep starting_cash name to avoid breaking; just treat it as cash_on_hand_start in UI.

-- 2. Create finance_expense_items table
CREATE TABLE IF NOT EXISTS public.finance_expense_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.finance_daily_reports(id) ON DELETE CASCADE,
  payment_type text NOT NULL DEFAULT 'cash' CHECK (payment_type IN ('cash','transfer')),
  item_name text NOT NULL DEFAULT '',
  unit_price numeric NOT NULL DEFAULT 0,
  qty numeric NOT NULL DEFAULT 1,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_expense_items_report ON public.finance_expense_items(report_id);

ALTER TABLE public.finance_expense_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access finance_expense_items" ON public.finance_expense_items;
CREATE POLICY "Admin full access finance_expense_items"
  ON public.finance_expense_items FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Management full access finance_expense_items" ON public.finance_expense_items;
CREATE POLICY "Management full access finance_expense_items"
  ON public.finance_expense_items FOR ALL
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

DROP POLICY IF EXISTS "PIC view finance_expense_items (own outlet)" ON public.finance_expense_items;
CREATE POLICY "PIC view finance_expense_items (own outlet)"
  ON public.finance_expense_items FOR SELECT
  USING (
    has_role(auth.uid(), 'pic'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.finance_daily_reports r
      WHERE r.id = finance_expense_items.report_id
        AND pic_can_access_outlet(r.outlet_id)
    )
  );

DROP POLICY IF EXISTS "PIC insert finance_expense_items (own outlet)" ON public.finance_expense_items;
CREATE POLICY "PIC insert finance_expense_items (own outlet)"
  ON public.finance_expense_items FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'pic'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.finance_daily_reports r
      WHERE r.id = finance_expense_items.report_id
        AND pic_can_access_outlet(r.outlet_id)
    )
  );