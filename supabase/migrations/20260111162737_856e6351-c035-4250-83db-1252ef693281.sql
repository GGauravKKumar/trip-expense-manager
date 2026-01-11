-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'driver');

-- Create enum for trip status
CREATE TYPE public.trip_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

-- Create enum for expense status
CREATE TYPE public.expense_status AS ENUM ('pending', 'approved', 'denied');

-- Create enum for bus status
CREATE TYPE public.bus_status AS ENUM ('active', 'maintenance', 'inactive');

-- Create user_roles table (for admin/driver role management)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    license_number TEXT,
    license_expiry DATE,
    address TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create buses table
CREATE TABLE public.buses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_number TEXT NOT NULL UNIQUE,
    bus_name TEXT,
    capacity INTEGER NOT NULL DEFAULT 40,
    bus_type TEXT DEFAULT 'AC Sleeper',
    status bus_status NOT NULL DEFAULT 'active',
    insurance_expiry DATE,
    puc_expiry DATE,
    fitness_expiry DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create Indian states table for routes
CREATE TABLE public.indian_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_name TEXT NOT NULL UNIQUE,
    state_code TEXT NOT NULL UNIQUE,
    is_union_territory BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create routes table
CREATE TABLE public.routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_name TEXT NOT NULL,
    from_state_id UUID REFERENCES public.indian_states(id) NOT NULL,
    to_state_id UUID REFERENCES public.indian_states(id) NOT NULL,
    from_address TEXT,
    to_address TEXT,
    distance_km DECIMAL(10,2),
    estimated_duration_hours DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trips table
CREATE TABLE public.trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_number TEXT NOT NULL UNIQUE,
    bus_id UUID REFERENCES public.buses(id) NOT NULL,
    driver_id UUID REFERENCES public.profiles(id) NOT NULL,
    route_id UUID REFERENCES public.routes(id) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    status trip_status NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    total_expense DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create expense categories table
CREATE TABLE public.expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create expenses table
CREATE TABLE public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES public.expense_categories(id) NOT NULL,
    submitted_by UUID REFERENCES public.profiles(id) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    document_url TEXT,
    status expense_status NOT NULL DEFAULT 'pending',
    admin_remarks TEXT,
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indian_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user profile id
CREATE OR REPLACE FUNCTION public.get_profile_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for buses (admin only management, drivers can view)
CREATE POLICY "Authenticated users can view buses"
ON public.buses FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage buses"
ON public.buses FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for indian_states (public read)
CREATE POLICY "Anyone can view indian states"
ON public.indian_states FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage indian states"
ON public.indian_states FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for routes
CREATE POLICY "Authenticated users can view routes"
ON public.routes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage routes"
ON public.routes FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for trips
CREATE POLICY "Drivers can view their own trips"
ON public.trips FOR SELECT
TO authenticated
USING (driver_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Admins can view all trips"
ON public.trips FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage trips"
ON public.trips FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for expense_categories (public read)
CREATE POLICY "Authenticated users can view expense categories"
ON public.expense_categories FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage expense categories"
ON public.expense_categories FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for expenses
CREATE POLICY "Drivers can view their own expenses"
ON public.expenses FOR SELECT
TO authenticated
USING (submitted_by = public.get_profile_id(auth.uid()));

CREATE POLICY "Drivers can insert their own expenses"
ON public.expenses FOR INSERT
TO authenticated
WITH CHECK (submitted_by = public.get_profile_id(auth.uid()));

CREATE POLICY "Drivers can update their pending expenses"
ON public.expenses FOR UPDATE
TO authenticated
USING (submitted_by = public.get_profile_id(auth.uid()) AND status = 'pending')
WITH CHECK (submitted_by = public.get_profile_id(auth.uid()) AND status = 'pending');

CREATE POLICY "Admins can view all expenses"
ON public.expenses FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all expenses"
ON public.expenses FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_buses_updated_at
    BEFORE UPDATE ON public.buses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_routes_updated_at
    BEFORE UPDATE ON public.routes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trips_updated_at
    BEFORE UPDATE ON public.trips
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to update trip total expense when expense is approved
CREATE OR REPLACE FUNCTION public.update_trip_total_expense()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        UPDATE public.trips
        SET total_expense = total_expense + NEW.amount
        WHERE id = NEW.trip_id;
    ELSIF OLD.status = 'approved' AND NEW.status != 'approved' THEN
        UPDATE public.trips
        SET total_expense = total_expense - OLD.amount
        WHERE id = NEW.trip_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_trip_expense_on_approval
    AFTER UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.update_trip_total_expense();

-- Create trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for expense documents
INSERT INTO storage.buckets (id, name, public) VALUES ('expense-documents', 'expense-documents', false);

-- Storage policies for expense documents
CREATE POLICY "Authenticated users can upload expense documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'expense-documents');

CREATE POLICY "Users can view their own expense documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'expense-documents');

CREATE POLICY "Admins can view all expense documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'expense-documents' AND public.has_role(auth.uid(), 'admin'));