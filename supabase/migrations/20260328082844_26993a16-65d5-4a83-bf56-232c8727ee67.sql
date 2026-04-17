
-- Role enum
CREATE TYPE public.app_role AS ENUM ('staff', 'management');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'staff',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Management can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  date_of_birth DATE,
  job_title TEXT DEFAULT '',
  discipline_points INTEGER DEFAULT 0,
  warning_letter_status TEXT DEFAULT 'Non-SP',
  employment_status TEXT DEFAULT 'Contract',
  contract_end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Management can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Management can update all profiles" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile and default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'staff');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Daily Financial Reports
CREATE TABLE public.financial_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  starting_cash NUMERIC(12,2) DEFAULT 0,
  daily_offline_income NUMERIC(12,2) DEFAULT 0,
  ending_physical_cash NUMERIC(12,2) DEFAULT 0,
  ending_qris_cash NUMERIC(12,2) DEFAULT 0,
  online_delivery_sales NUMERIC(12,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.financial_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own reports" ON public.financial_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own reports" ON public.financial_reports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Management can view all reports" ON public.financial_reports
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

-- Expense items
CREATE TABLE public.expense_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.financial_reports(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert expenses" ON public.expense_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.financial_reports WHERE id = report_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can view own expenses" ON public.expense_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.financial_reports WHERE id = report_id AND user_id = auth.uid())
  );
CREATE POLICY "Management can view all expenses" ON public.expense_items
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

-- Inventory
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  item_name TEXT NOT NULL,
  starting_stock NUMERIC(10,2) DEFAULT 0,
  incoming_stock NUMERIC(10,2) DEFAULT 0,
  ending_stock NUMERIC(10,2) DEFAULT 0,
  minimum_threshold NUMERIC(10,2) DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert inventory" ON public.inventory
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own inventory" ON public.inventory
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Management can view all inventory" ON public.inventory
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

-- Leave Requests
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own leave" ON public.leave_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own leave" ON public.leave_requests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Management can view all leave" ON public.leave_requests
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management can update leave" ON public.leave_requests
  FOR UPDATE USING (public.has_role(auth.uid(), 'management'));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_financial_reports_updated_at BEFORE UPDATE ON public.financial_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
