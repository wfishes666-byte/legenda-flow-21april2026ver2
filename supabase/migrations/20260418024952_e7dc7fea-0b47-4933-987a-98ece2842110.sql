
-- Master katalog item
CREATE TABLE public.item_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  default_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.item_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view catalog" ON public.item_catalog
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Management full access catalog" ON public.item_catalog
  FOR ALL USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "PIC can insert catalog" ON public.item_catalog
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'pic'::app_role));
CREATE POLICY "PIC can update catalog" ON public.item_catalog
  FOR UPDATE USING (has_role(auth.uid(), 'pic'::app_role));

CREATE TRIGGER trg_item_catalog_updated
  BEFORE UPDATE ON public.item_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invoice header
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management full access invoices" ON public.invoices
  FOR ALL USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "PIC view invoices" ON public.invoices
  FOR SELECT USING (has_role(auth.uid(), 'pic'::app_role));
CREATE POLICY "PIC insert invoices" ON public.invoices
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'pic'::app_role));
CREATE POLICY "PIC update invoices" ON public.invoices
  FOR UPDATE USING (has_role(auth.uid(), 'pic'::app_role));

CREATE TRIGGER trg_invoices_updated
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invoice items
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  qty NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management full access invoice_items" ON public.invoice_items
  FOR ALL USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "PIC view invoice_items" ON public.invoice_items
  FOR SELECT USING (has_role(auth.uid(), 'pic'::app_role));
CREATE POLICY "PIC insert invoice_items" ON public.invoice_items
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'pic'::app_role));
CREATE POLICY "PIC update invoice_items" ON public.invoice_items
  FOR UPDATE USING (has_role(auth.uid(), 'pic'::app_role));
CREATE POLICY "PIC delete invoice_items" ON public.invoice_items
  FOR DELETE USING (has_role(auth.uid(), 'pic'::app_role));

CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX idx_invoices_outlet_date ON public.invoices(outlet_id, invoice_date);
