
-- Create outlets table
CREATE TABLE public.outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read outlets
CREATE POLICY "Authenticated users can view outlets" ON public.outlets
  FOR SELECT TO authenticated USING (true);

-- Only management can manage outlets
CREATE POLICY "Management can insert outlets" ON public.outlets
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'management'));

-- Seed the 4 outlets
INSERT INTO public.outlets (name) VALUES
  ('Depot Dua Legenda'),
  ('Pengyu Kopitiam'),
  ('Warkop Tarkam'),
  ('Warehouse Dua Legenda');

-- Add outlet_id to financial_reports
ALTER TABLE public.financial_reports ADD COLUMN outlet_id uuid REFERENCES public.outlets(id);

-- Add outlet_id to inventory
ALTER TABLE public.inventory ADD COLUMN outlet_id uuid REFERENCES public.outlets(id);
