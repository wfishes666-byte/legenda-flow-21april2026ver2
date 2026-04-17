
-- Management DELETE policies
CREATE POLICY "Management can delete profiles" ON public.profiles FOR DELETE USING (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "Management can delete reports" ON public.financial_reports FOR DELETE USING (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "Management can delete expenses" ON public.expense_items FOR DELETE USING (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "Management can delete inventory" ON public.inventory FOR DELETE USING (has_role(auth.uid(), 'management'::app_role));

-- Management missing INSERT/UPDATE
CREATE POLICY "Management can insert all reports" ON public.financial_reports FOR INSERT WITH CHECK (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "Management can update all reports" ON public.financial_reports FOR UPDATE USING (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "Management can insert all inventory" ON public.inventory FOR INSERT WITH CHECK (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "Management can update all inventory" ON public.inventory FOR UPDATE USING (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "Management can insert all expenses" ON public.expense_items FOR INSERT WITH CHECK (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "Management can update expenses" ON public.expense_items FOR UPDATE USING (has_role(auth.uid(), 'management'::app_role));

-- PIC: view + edit all (no delete)
CREATE POLICY "PIC can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'pic'::app_role));
CREATE POLICY "PIC can update all profiles" ON public.profiles FOR UPDATE USING (has_role(auth.uid(), 'pic'::app_role));
CREATE POLICY "PIC can view all reports" ON public.financial_reports FOR SELECT USING (has_role(auth.uid(), 'pic'::app_role));
CREATE POLICY "PIC can update all reports" ON public.financial_reports FOR UPDATE USING (has_role(auth.uid(), 'pic'::app_role));
CREATE POLICY "PIC can insert reports" ON public.financial_reports FOR INSERT WITH CHECK (has_role(auth.uid(), 'pic'::app_role));
CREATE POLICY "PIC can view all inventory" ON public.inventory FOR SELECT USING (has_role(auth.uid(), 'pic'::app_role));
CREATE POLICY "PIC can update all inventory" ON public.inventory FOR UPDATE USING (has_role(auth.uid(), 'pic'::app_role));
CREATE POLICY "PIC can insert inventory" ON public.inventory FOR INSERT WITH CHECK (has_role(auth.uid(), 'pic'::app_role));
CREATE POLICY "PIC can view all expenses" ON public.expense_items FOR SELECT USING (has_role(auth.uid(), 'pic'::app_role));
CREATE POLICY "PIC can insert expenses" ON public.expense_items FOR INSERT WITH CHECK (has_role(auth.uid(), 'pic'::app_role));

-- Stockman: inventory full access
CREATE POLICY "Stockman can view all inventory" ON public.inventory FOR SELECT USING (has_role(auth.uid(), 'stockman'::app_role));
CREATE POLICY "Stockman can update inventory" ON public.inventory FOR UPDATE USING (has_role(auth.uid(), 'stockman'::app_role));
CREATE POLICY "Stockman can insert inventory" ON public.inventory FOR INSERT WITH CHECK (has_role(auth.uid(), 'stockman'::app_role));
