
-- Tambah kolom baru ke financial_reports
ALTER TABLE public.financial_reports
  ADD COLUMN IF NOT EXISTS reporter_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS shift text DEFAULT 'Full Day',
  ADD COLUMN IF NOT EXISTS dine_in_omzet numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shopeefood_sales numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gofood_sales numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grabfood_sales numeric DEFAULT 0;

-- Tambah kolom baru ke expense_items
ALTER TABLE public.expense_items
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Lain-lain',
  ADD COLUMN IF NOT EXISTS unit_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS receipt_url text DEFAULT NULL;

-- Tabel kategori pengeluaran (per user, bisa dikelola)
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own categories" ON public.expense_categories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Management full access categories list" ON public.expense_categories
  FOR ALL USING (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "PIC view categories" ON public.expense_categories
  FOR SELECT USING (has_role(auth.uid(), 'pic'::app_role));

-- Bucket storage untuk foto nota
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies untuk bucket
CREATE POLICY "Receipts publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'expense-receipts');

CREATE POLICY "Authenticated users upload receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users update own receipts"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'expense-receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own receipts"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'expense-receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
