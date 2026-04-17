-- Create sp_history table to log every SP issuance
CREATE TABLE public.sp_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sp_level TEXT NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  issued_by UUID,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  printed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sp_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management full access sp_history"
ON public.sp_history FOR ALL
USING (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "PIC can insert sp_history"
ON public.sp_history FOR INSERT
WITH CHECK (has_role(auth.uid(), 'pic'::app_role));

CREATE POLICY "PIC can view sp_history"
ON public.sp_history FOR SELECT
USING (has_role(auth.uid(), 'pic'::app_role));

CREATE POLICY "Users can view own sp_history"
ON public.sp_history FOR SELECT
USING (auth.uid() = user_id);

CREATE INDEX idx_sp_history_user ON public.sp_history(user_id, issued_date DESC);