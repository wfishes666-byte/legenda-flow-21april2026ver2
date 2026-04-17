
-- Attendance table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in TIME,
  check_out TIME,
  status TEXT NOT NULL DEFAULT 'hadir' CHECK (status IN ('hadir', 'izin', 'sakit', 'alpha', 'cuti')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, attendance_date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management full access attendance" ON public.attendance FOR ALL USING (has_role(auth.uid(), 'management'));
CREATE POLICY "PIC can view attendance" ON public.attendance FOR SELECT USING (has_role(auth.uid(), 'pic'));
CREATE POLICY "PIC can insert attendance" ON public.attendance FOR INSERT WITH CHECK (has_role(auth.uid(), 'pic'));
CREATE POLICY "PIC can update attendance" ON public.attendance FOR UPDATE USING (has_role(auth.uid(), 'pic'));
CREATE POLICY "Users can view own attendance" ON public.attendance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attendance" ON public.attendance FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Cashbon table
CREATE TABLE public.cashbon (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  notes TEXT DEFAULT '',
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.cashbon ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management full access cashbon" ON public.cashbon FOR ALL USING (has_role(auth.uid(), 'management'));
CREATE POLICY "PIC can view cashbon" ON public.cashbon FOR SELECT USING (has_role(auth.uid(), 'pic'));
CREATE POLICY "PIC can update cashbon" ON public.cashbon FOR UPDATE USING (has_role(auth.uid(), 'pic'));
CREATE POLICY "Users can view own cashbon" ON public.cashbon FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cashbon" ON public.cashbon FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Performance reviews table
CREATE TABLE public.performance_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reviewer_id UUID NOT NULL,
  review_period TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  categories JSONB DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management full access reviews" ON public.performance_reviews FOR ALL USING (has_role(auth.uid(), 'management'));
CREATE POLICY "PIC can view reviews" ON public.performance_reviews FOR SELECT USING (has_role(auth.uid(), 'pic'));
CREATE POLICY "PIC can insert reviews" ON public.performance_reviews FOR INSERT WITH CHECK (has_role(auth.uid(), 'pic'));
CREATE POLICY "PIC can update reviews" ON public.performance_reviews FOR UPDATE USING (has_role(auth.uid(), 'pic'));
CREATE POLICY "Users can view own reviews" ON public.performance_reviews FOR SELECT USING (auth.uid() = user_id);

-- Punishments table
CREATE TABLE public.punishments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  points_added INTEGER NOT NULL DEFAULT 0,
  new_sp_status TEXT DEFAULT 'Non-SP',
  reason TEXT NOT NULL DEFAULT '',
  issued_by UUID,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.punishments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management full access punishments" ON public.punishments FOR ALL USING (has_role(auth.uid(), 'management'));
CREATE POLICY "PIC can view punishments" ON public.punishments FOR SELECT USING (has_role(auth.uid(), 'pic'));
CREATE POLICY "PIC can insert punishments" ON public.punishments FOR INSERT WITH CHECK (has_role(auth.uid(), 'pic'));
CREATE POLICY "Users can view own punishments" ON public.punishments FOR SELECT USING (auth.uid() = user_id);

-- Payroll table
CREATE TABLE public.payroll (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  period_year INTEGER NOT NULL,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  meal_allowance NUMERIC DEFAULT 0,
  transport_allowance NUMERIC DEFAULT 0,
  other_allowance NUMERIC DEFAULT 0,
  absence_deduction NUMERIC DEFAULT 0,
  cashbon_deduction NUMERIC DEFAULT 0,
  punishment_deduction NUMERIC DEFAULT 0,
  other_deduction NUMERIC DEFAULT 0,
  net_salary NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'paid')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, period_month, period_year)
);
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management full access payroll" ON public.payroll FOR ALL USING (has_role(auth.uid(), 'management'));
CREATE POLICY "PIC can view payroll" ON public.payroll FOR SELECT USING (has_role(auth.uid(), 'pic'));
CREATE POLICY "Users can view own payroll" ON public.payroll FOR SELECT USING (auth.uid() = user_id);

-- Content plans (Marketing)
CREATE TABLE public.content_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  platform TEXT NOT NULL DEFAULT 'instagram',
  scheduled_date DATE,
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'draft', 'in_progress', 'review', 'posted')),
  assigned_to UUID,
  created_by UUID NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.content_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management full access content" ON public.content_plans FOR ALL USING (has_role(auth.uid(), 'management'));
CREATE POLICY "PIC can view content" ON public.content_plans FOR SELECT USING (has_role(auth.uid(), 'pic'));
CREATE POLICY "PIC can insert content" ON public.content_plans FOR INSERT WITH CHECK (has_role(auth.uid(), 'pic'));
CREATE POLICY "PIC can update content" ON public.content_plans FOR UPDATE USING (has_role(auth.uid(), 'pic'));

-- Recipes for material control
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_name TEXT NOT NULL,
  outlet_id UUID,
  ingredients JSONB NOT NULL DEFAULT '[]',
  portions INTEGER DEFAULT 1,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management full access recipes" ON public.recipes FOR ALL USING (has_role(auth.uid(), 'management'));
CREATE POLICY "PIC can view recipes" ON public.recipes FOR SELECT USING (has_role(auth.uid(), 'pic'));
CREATE POLICY "PIC can insert recipes" ON public.recipes FOR INSERT WITH CHECK (has_role(auth.uid(), 'pic'));
CREATE POLICY "PIC can update recipes" ON public.recipes FOR UPDATE USING (has_role(auth.uid(), 'pic'));
CREATE POLICY "Stockman can view recipes" ON public.recipes FOR SELECT USING (has_role(auth.uid(), 'stockman'));
CREATE POLICY "Stockman can insert recipes" ON public.recipes FOR INSERT WITH CHECK (has_role(auth.uid(), 'stockman'));
CREATE POLICY "Stockman can update recipes" ON public.recipes FOR UPDATE USING (has_role(auth.uid(), 'stockman'));

-- Daily sales for material control
CREATE TABLE public.daily_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_name TEXT NOT NULL,
  qty_sold INTEGER NOT NULL DEFAULT 0,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  outlet_id UUID,
  recorded_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(menu_item_name, sale_date, outlet_id)
);
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management full access daily_sales" ON public.daily_sales FOR ALL USING (has_role(auth.uid(), 'management'));
CREATE POLICY "PIC can view daily_sales" ON public.daily_sales FOR SELECT USING (has_role(auth.uid(), 'pic'));
CREATE POLICY "PIC can insert daily_sales" ON public.daily_sales FOR INSERT WITH CHECK (has_role(auth.uid(), 'pic'));
CREATE POLICY "Stockman can view daily_sales" ON public.daily_sales FOR SELECT USING (has_role(auth.uid(), 'stockman'));
CREATE POLICY "Stockman can insert daily_sales" ON public.daily_sales FOR INSERT WITH CHECK (has_role(auth.uid(), 'stockman'));
CREATE POLICY "Stockman can update daily_sales" ON public.daily_sales FOR UPDATE USING (has_role(auth.uid(), 'stockman'));

-- Profit/Loss categories
CREATE TABLE public.profit_loss_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profit_loss_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view categories" ON public.profit_loss_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Management full access categories" ON public.profit_loss_categories FOR ALL USING (has_role(auth.uid(), 'management'));

-- Update triggers
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cashbon_updated_at BEFORE UPDATE ON public.cashbon FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.performance_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payroll_updated_at BEFORE UPDATE ON public.payroll FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_content_plans_updated_at BEFORE UPDATE ON public.content_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
