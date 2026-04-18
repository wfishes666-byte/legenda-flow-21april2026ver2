-- Helper: ambil outlet_id PIC yang sedang login (NULL = lihat semua cabang)
CREATE OR REPLACE FUNCTION public.get_user_outlet(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT outlet_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- Helper: cek apakah PIC boleh akses outlet tertentu (NULL outlet di profil = semua boleh)
CREATE OR REPLACE FUNCTION public.pic_can_access_outlet(_outlet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN NOT public.has_role(auth.uid(), 'pic') THEN true
      WHEN public.get_user_outlet(auth.uid()) IS NULL THEN true
      WHEN _outlet_id IS NULL THEN true
      ELSE _outlet_id = public.get_user_outlet(auth.uid())
    END;
$$;

-- ============================================================
-- ATTENDANCE: PIC tetap bisa update (operasional harian) + filter cabang
-- ============================================================
DROP POLICY IF EXISTS "PIC can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "PIC can insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "PIC can update attendance" ON public.attendance;

CREATE POLICY "PIC can view attendance (own outlet)"
  ON public.attendance FOR SELECT
  USING (has_role(auth.uid(), 'pic') AND public.pic_can_access_outlet(outlet_id));

CREATE POLICY "PIC can insert attendance (own outlet)"
  ON public.attendance FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'pic') AND public.pic_can_access_outlet(outlet_id));

CREATE POLICY "PIC can update attendance (own outlet)"
  ON public.attendance FOR UPDATE
  USING (has_role(auth.uid(), 'pic') AND public.pic_can_access_outlet(outlet_id));

-- ============================================================
-- ATTENDANCE_LOGS: filter cabang
-- ============================================================
DROP POLICY IF EXISTS "PIC view all attendance logs" ON public.attendance_logs;

CREATE POLICY "PIC view attendance logs (own outlet)"
  ON public.attendance_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'pic') AND public.pic_can_access_outlet(outlet_id));

-- ============================================================
-- CASHBON: PIC tetap bisa update (operasional harian)
-- (tidak ada outlet_id di tabel ini, tetap akses semua sesuai role)
-- Policy lama dipertahankan.
-- ============================================================

-- ============================================================
-- LEAVE_REQUESTS: PIC tambahan akses update (operasional harian)
-- ============================================================
DROP POLICY IF EXISTS "PIC can view leave" ON public.leave_requests;
DROP POLICY IF EXISTS "PIC can update leave" ON public.leave_requests;

CREATE POLICY "PIC can view leave"
  ON public.leave_requests FOR SELECT
  USING (has_role(auth.uid(), 'pic'));

CREATE POLICY "PIC can update leave"
  ON public.leave_requests FOR UPDATE
  USING (has_role(auth.uid(), 'pic'));

-- ============================================================
-- FINANCIAL_REPORTS: PIC view+insert sesuai cabang, TIDAK bisa update
-- ============================================================
DROP POLICY IF EXISTS "PIC can view all reports" ON public.financial_reports;
DROP POLICY IF EXISTS "PIC can insert reports" ON public.financial_reports;
DROP POLICY IF EXISTS "PIC can update all reports" ON public.financial_reports;

CREATE POLICY "PIC can view reports (own outlet)"
  ON public.financial_reports FOR SELECT
  USING (has_role(auth.uid(), 'pic') AND public.pic_can_access_outlet(outlet_id));

CREATE POLICY "PIC can insert reports (own outlet)"
  ON public.financial_reports FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'pic') AND public.pic_can_access_outlet(outlet_id));

-- ============================================================
-- EXPENSE_ITEMS: PIC view+insert via report's outlet, TIDAK update/delete
-- ============================================================
DROP POLICY IF EXISTS "PIC can view all expenses" ON public.expense_items;
DROP POLICY IF EXISTS "PIC can insert expenses" ON public.expense_items;

CREATE POLICY "PIC can view expenses (own outlet)"
  ON public.expense_items FOR SELECT
  USING (
    has_role(auth.uid(), 'pic') AND EXISTS (
      SELECT 1 FROM public.financial_reports r
      WHERE r.id = expense_items.report_id
        AND public.pic_can_access_outlet(r.outlet_id)
    )
  );

CREATE POLICY "PIC can insert expenses (own outlet)"
  ON public.expense_items FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'pic') AND EXISTS (
      SELECT 1 FROM public.financial_reports r
      WHERE r.id = expense_items.report_id
        AND public.pic_can_access_outlet(r.outlet_id)
    )
  );

-- ============================================================
-- INVENTORY: PIC view+insert sesuai cabang, TIDAK update
-- ============================================================
DROP POLICY IF EXISTS "PIC can view all inventory" ON public.inventory;
DROP POLICY IF EXISTS "PIC can insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "PIC can update all inventory" ON public.inventory;

CREATE POLICY "PIC can view inventory (own outlet)"
  ON public.inventory FOR SELECT
  USING (has_role(auth.uid(), 'pic') AND public.pic_can_access_outlet(outlet_id));

CREATE POLICY "PIC can insert inventory (own outlet)"
  ON public.inventory FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'pic') AND public.pic_can_access_outlet(outlet_id));

-- ============================================================
-- INVOICES & INVOICE_ITEMS: PIC view+insert sesuai cabang, TIDAK update/delete
-- ============================================================
DROP POLICY IF EXISTS "PIC view invoices" ON public.invoices;
DROP POLICY IF EXISTS "PIC insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "PIC update invoices" ON public.invoices;

CREATE POLICY "PIC view invoices (own outlet)"
  ON public.invoices FOR SELECT
  USING (has_role(auth.uid(), 'pic') AND public.pic_can_access_outlet(outlet_id));

CREATE POLICY "PIC insert invoices (own outlet)"
  ON public.invoices FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'pic') AND public.pic_can_access_outlet(outlet_id));

DROP POLICY IF EXISTS "PIC view invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "PIC insert invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "PIC update invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "PIC delete invoice_items" ON public.invoice_items;

CREATE POLICY "PIC view invoice_items (own outlet)"
  ON public.invoice_items FOR SELECT
  USING (
    has_role(auth.uid(), 'pic') AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND public.pic_can_access_outlet(i.outlet_id)
    )
  );

CREATE POLICY "PIC insert invoice_items (own outlet)"
  ON public.invoice_items FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'pic') AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND public.pic_can_access_outlet(i.outlet_id)
    )
  );

-- ============================================================
-- DAILY_SALES: PIC view+insert sesuai cabang
-- ============================================================
DROP POLICY IF EXISTS "PIC can view daily_sales" ON public.daily_sales;
DROP POLICY IF EXISTS "PIC can insert daily_sales" ON public.daily_sales;

CREATE POLICY "PIC can view daily_sales (own outlet)"
  ON public.daily_sales FOR SELECT
  USING (has_role(auth.uid(), 'pic') AND public.pic_can_access_outlet(outlet_id));

CREATE POLICY "PIC can insert daily_sales (own outlet)"
  ON public.daily_sales FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'pic') AND public.pic_can_access_outlet(outlet_id));

-- ============================================================
-- PROFILES: PIC view+insert sesuai cabang, TIDAK update
-- ============================================================
DROP POLICY IF EXISTS "PIC can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "PIC can update all profiles" ON public.profiles;

CREATE POLICY "PIC can view profiles (own outlet)"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'pic') AND public.pic_can_access_outlet(outlet_id));

-- ============================================================
-- CONTENT_PLANS: TIDAK ada update untuk PIC
-- ============================================================
DROP POLICY IF EXISTS "PIC can update content" ON public.content_plans;

-- ============================================================
-- RECIPES: TIDAK ada update untuk PIC
-- ============================================================
DROP POLICY IF EXISTS "PIC can update recipes" ON public.recipes;

-- ============================================================
-- ITEM_CATALOG: TIDAK ada update untuk PIC
-- ============================================================
DROP POLICY IF EXISTS "PIC can update catalog" ON public.item_catalog;

-- ============================================================
-- PERFORMANCE_REVIEWS: TIDAK ada update untuk PIC
-- ============================================================
DROP POLICY IF EXISTS "PIC can update reviews" ON public.performance_reviews;
