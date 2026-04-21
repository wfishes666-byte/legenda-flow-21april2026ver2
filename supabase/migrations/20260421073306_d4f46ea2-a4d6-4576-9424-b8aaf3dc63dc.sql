ALTER TABLE public.finance_expense_items
ADD COLUMN IF NOT EXISTS category text DEFAULT 'Lain-lain';

CREATE INDEX IF NOT EXISTS idx_finance_expense_items_category
ON public.finance_expense_items (category);