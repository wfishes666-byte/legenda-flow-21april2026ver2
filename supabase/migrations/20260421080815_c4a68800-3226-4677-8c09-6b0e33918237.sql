
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS recipient TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);

-- Backfill invoice_number for existing rows: INV-YYYYMMDD-#### (per day, ordered by created_at)
WITH numbered AS (
  SELECT id,
         'INV-' || to_char(invoice_date, 'YYYYMMDD') || '-' ||
         lpad(row_number() OVER (PARTITION BY invoice_date ORDER BY created_at)::text, 4, '0') AS num
  FROM public.invoices
  WHERE invoice_number IS NULL
)
UPDATE public.invoices i SET invoice_number = n.num
FROM numbered n WHERE i.id = n.id;
