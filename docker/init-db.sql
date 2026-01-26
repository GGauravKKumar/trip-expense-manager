-- BusManager Database Initialization Script
-- This script sets up the complete database schema for self-hosted deployment
-- Updated: Complete schema matching cloud deployment

-- ===========================================
-- EXTENSIONS
-- ===========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===========================================
-- SCHEMAS
-- ===========================================
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS realtime;

-- ===========================================
-- ROLES
-- ===========================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
        CREATE ROLE supabase_storage_admin NOLOGIN NOINHERIT;
    END IF;
END
$$;

-- Grant schema permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin, service_role;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin, service_role;

-- ===========================================
-- AUTH SCHEMA (minimal for GoTrue)
-- ===========================================
CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE,
    encrypted_password text,
    email_confirmed_at timestamptz,
    invited_at timestamptz,
    confirmation_token text,
    confirmation_sent_at timestamptz,
    recovery_token text,
    recovery_sent_at timestamptz,
    email_change_token_new text,
    email_change text,
    email_change_sent_at timestamptz,
    last_sign_in_at timestamptz,
    raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    is_super_admin boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    phone text UNIQUE,
    phone_confirmed_at timestamptz,
    phone_change text,
    phone_change_token text,
    phone_change_sent_at timestamptz,
    confirmed_at timestamptz GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current text,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamptz,
    reauthentication_token text,
    reauthentication_sent_at timestamptz,
    is_sso_user boolean DEFAULT false,
    deleted_at timestamptz,
    role text,
    instance_id uuid,
    aud text
);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id bigserial PRIMARY KEY,
    token text,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    revoked boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    parent text,
    session_id uuid
);

CREATE TABLE IF NOT EXISTS auth.sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    factor_id uuid,
    aal text,
    not_after timestamptz,
    refreshed_at timestamptz,
    user_agent text,
    ip text
);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin, service_role;

-- ===========================================
-- STORAGE SCHEMA
-- ===========================================
CREATE TABLE IF NOT EXISTS storage.buckets (
    id text PRIMARY KEY,
    name text NOT NULL UNIQUE,
    owner uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[]
);

CREATE TABLE IF NOT EXISTS storage.objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text REFERENCES storage.buckets(id),
    name text,
    owner uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    last_accessed_at timestamptz DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED,
    version text,
    owner_id text
);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO supabase_storage_admin, service_role;

-- ===========================================
-- PUBLIC SCHEMA - CUSTOM ENUMS
-- ===========================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'driver', 'repair_org');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bus_status') THEN
        CREATE TYPE public.bus_status AS ENUM ('active', 'maintenance', 'inactive');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_status') THEN
        CREATE TYPE public.expense_status AS ENUM ('pending', 'approved', 'denied');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trip_status') THEN
        CREATE TYPE public.trip_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ownership_type') THEN
        CREATE TYPE public.ownership_type AS ENUM ('owned', 'partnership');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_status') THEN
        CREATE TYPE public.tax_status AS ENUM ('pending', 'paid', 'overdue');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
        CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_type') THEN
        CREATE TYPE public.invoice_type AS ENUM ('customer', 'online_app', 'charter');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_transaction_type') THEN
        CREATE TYPE public.stock_transaction_type AS ENUM ('add', 'remove', 'adjustment');
    END IF;
END
$$;

-- ===========================================
-- PUBLIC SCHEMA - TABLES
-- ===========================================

-- Indian States table
CREATE TABLE IF NOT EXISTS public.indian_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    state_name text NOT NULL,
    state_code text NOT NULL,
    is_union_territory boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Buses table
CREATE TABLE IF NOT EXISTS public.buses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_number text NOT NULL,
    bus_name text,
    capacity integer NOT NULL DEFAULT 40,
    bus_type text DEFAULT 'AC Sleeper',
    status bus_status NOT NULL DEFAULT 'active',
    insurance_expiry date,
    puc_expiry date,
    fitness_expiry date,
    ownership_type ownership_type NOT NULL DEFAULT 'owned',
    partner_name text,
    company_profit_share numeric NOT NULL DEFAULT 100,
    partner_profit_share numeric NOT NULL DEFAULT 0,
    home_state_id uuid REFERENCES indian_states(id),
    monthly_tax_amount numeric DEFAULT 0,
    tax_due_day integer DEFAULT 1,
    last_tax_paid_date date,
    next_tax_due_date date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Bus Tax Records table
CREATE TABLE IF NOT EXISTS public.bus_tax_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bus_id uuid NOT NULL REFERENCES buses(id),
    tax_period_start date NOT NULL,
    tax_period_end date NOT NULL,
    due_date date NOT NULL,
    amount numeric NOT NULL,
    status tax_status NOT NULL DEFAULT 'pending',
    paid_date date,
    payment_reference text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Repair Organizations table
CREATE TABLE IF NOT EXISTS public.repair_organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_code text NOT NULL UNIQUE,
    org_name text NOT NULL,
    contact_person text,
    phone text,
    email text,
    address text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    full_name text NOT NULL,
    phone text,
    license_number text,
    license_expiry date,
    address text,
    avatar_url text,
    repair_org_id uuid REFERENCES repair_organizations(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- User Roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    role app_role NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Routes table
CREATE TABLE IF NOT EXISTS public.routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    route_name text NOT NULL,
    from_state_id uuid NOT NULL REFERENCES indian_states(id),
    to_state_id uuid NOT NULL REFERENCES indian_states(id),
    from_address text,
    to_address text,
    distance_km numeric,
    estimated_duration_hours numeric,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Bus Schedules table
CREATE TABLE IF NOT EXISTS public.bus_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bus_id uuid NOT NULL REFERENCES buses(id),
    route_id uuid NOT NULL REFERENCES routes(id),
    driver_id uuid REFERENCES profiles(id),
    days_of_week text[] NOT NULL DEFAULT '{}',
    departure_time time NOT NULL,
    arrival_time time NOT NULL,
    is_two_way boolean NOT NULL DEFAULT true,
    return_departure_time time,
    return_arrival_time time,
    is_active boolean NOT NULL DEFAULT true,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trips table
CREATE TABLE IF NOT EXISTS public.trips (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_number text NOT NULL,
    bus_id uuid REFERENCES buses(id),
    driver_id uuid REFERENCES profiles(id),
    route_id uuid NOT NULL REFERENCES routes(id),
    schedule_id uuid REFERENCES bus_schedules(id),
    start_date timestamptz NOT NULL,
    end_date timestamptz,
    trip_date date,
    status trip_status NOT NULL DEFAULT 'scheduled',
    trip_type text NOT NULL DEFAULT 'one_way',
    notes text,
    bus_name_snapshot text,
    driver_name_snapshot text,
    -- Outward journey
    departure_time time,
    arrival_time time,
    odometer_start numeric,
    odometer_end numeric,
    distance_traveled numeric GENERATED ALWAYS AS (
        CASE WHEN odometer_end IS NOT NULL AND odometer_start IS NOT NULL 
        THEN odometer_end - odometer_start ELSE NULL END
    ) STORED,
    revenue_cash numeric DEFAULT 0,
    revenue_online numeric DEFAULT 0,
    revenue_paytm numeric DEFAULT 0,
    revenue_others numeric DEFAULT 0,
    revenue_agent numeric DEFAULT 0,
    total_revenue numeric GENERATED ALWAYS AS (
        COALESCE(revenue_cash, 0) + COALESCE(revenue_online, 0) + 
        COALESCE(revenue_paytm, 0) + COALESCE(revenue_others, 0) + 
        COALESCE(revenue_agent, 0)
    ) STORED,
    total_expense numeric DEFAULT 0,
    gst_percentage numeric DEFAULT 18,
    water_taken integer DEFAULT 0,
    -- Return journey
    return_departure_time time,
    return_arrival_time time,
    odometer_return_start numeric,
    odometer_return_end numeric,
    distance_return numeric GENERATED ALWAYS AS (
        CASE WHEN odometer_return_end IS NOT NULL AND odometer_return_start IS NOT NULL 
        THEN odometer_return_end - odometer_return_start ELSE NULL END
    ) STORED,
    return_revenue_cash numeric DEFAULT 0,
    return_revenue_online numeric DEFAULT 0,
    return_revenue_paytm numeric DEFAULT 0,
    return_revenue_others numeric DEFAULT 0,
    return_revenue_agent numeric DEFAULT 0,
    return_total_revenue numeric DEFAULT 0,
    return_total_expense numeric DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Expense Categories table
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    icon text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id uuid NOT NULL REFERENCES trips(id),
    category_id uuid NOT NULL REFERENCES expense_categories(id),
    submitted_by uuid NOT NULL REFERENCES profiles(id),
    amount numeric NOT NULL,
    expense_date date NOT NULL DEFAULT CURRENT_DATE,
    description text,
    document_url text,
    fuel_quantity numeric,
    status expense_status NOT NULL DEFAULT 'pending',
    admin_remarks text,
    approved_by uuid REFERENCES profiles(id),
    approved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Repair Records table
CREATE TABLE IF NOT EXISTS public.repair_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    repair_number text NOT NULL,
    organization_id uuid NOT NULL REFERENCES repair_organizations(id),
    bus_id uuid REFERENCES buses(id),
    bus_registration text NOT NULL,
    repair_date date NOT NULL DEFAULT CURRENT_DATE,
    repair_type text NOT NULL,
    description text NOT NULL,
    parts_changed text,
    parts_cost numeric DEFAULT 0,
    labor_cost numeric DEFAULT 0,
    total_cost numeric,
    warranty_days integer DEFAULT 0,
    status text NOT NULL DEFAULT 'submitted',
    notes text,
    photo_before_url text,
    photo_after_url text,
    submitted_by uuid REFERENCES profiles(id),
    approved_by uuid,
    approved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Admin Settings table
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    value text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Stock Items table
CREATE TABLE IF NOT EXISTS public.stock_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name text NOT NULL,
    quantity integer NOT NULL DEFAULT 0,
    unit text NOT NULL DEFAULT 'pieces',
    unit_price numeric DEFAULT 0,
    low_stock_threshold integer NOT NULL DEFAULT 50,
    notes text,
    last_updated_by uuid REFERENCES profiles(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Stock Transactions table
CREATE TABLE IF NOT EXISTS public.stock_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_item_id uuid NOT NULL REFERENCES stock_items(id),
    transaction_type stock_transaction_type NOT NULL,
    quantity_change integer NOT NULL,
    previous_quantity integer NOT NULL,
    new_quantity integer NOT NULL,
    notes text,
    created_by uuid REFERENCES profiles(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number text NOT NULL UNIQUE,
    invoice_date date NOT NULL DEFAULT CURRENT_DATE,
    due_date date,
    invoice_type invoice_type NOT NULL DEFAULT 'customer',
    customer_name text NOT NULL,
    customer_address text,
    customer_phone text,
    customer_gst text,
    trip_id uuid REFERENCES trips(id),
    bus_id uuid REFERENCES buses(id),
    subtotal numeric NOT NULL DEFAULT 0,
    gst_amount numeric NOT NULL DEFAULT 0,
    total_amount numeric NOT NULL DEFAULT 0,
    amount_paid numeric NOT NULL DEFAULT 0,
    balance_due numeric NOT NULL DEFAULT 0,
    status invoice_status NOT NULL DEFAULT 'draft',
    notes text,
    terms text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Invoice Line Items table
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description text NOT NULL,
    quantity numeric NOT NULL DEFAULT 1,
    unit_price numeric NOT NULL DEFAULT 0,
    gst_percentage numeric NOT NULL DEFAULT 18,
    rate_includes_gst boolean NOT NULL DEFAULT false,
    base_amount numeric NOT NULL DEFAULT 0,
    gst_amount numeric NOT NULL DEFAULT 0,
    amount numeric NOT NULL DEFAULT 0,
    is_deduction boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Invoice Payments table
CREATE TABLE IF NOT EXISTS public.invoice_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount numeric NOT NULL,
    payment_date date NOT NULL DEFAULT CURRENT_DATE,
    payment_mode text NOT NULL DEFAULT 'Cash',
    reference_number text,
    notes text,
    created_by uuid REFERENCES profiles(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL DEFAULT 'info',
    read boolean NOT NULL DEFAULT false,
    link text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ===========================================
-- DATABASE FUNCTIONS
-- ===========================================

-- Check if user has role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get profile ID from user ID
CREATE OR REPLACE FUNCTION public.get_profile_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Update trip total expense
CREATE OR REPLACE FUNCTION public.update_trip_total_expense()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        UPDATE public.trips SET total_expense = total_expense + NEW.amount WHERE id = NEW.trip_id;
    ELSIF OLD.status = 'approved' AND NEW.status != 'approved' THEN
        UPDATE public.trips SET total_expense = total_expense - OLD.amount WHERE id = NEW.trip_id;
    END IF;
    RETURN NEW;
END;
$$;

-- Handle new user (create profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    RETURN NEW;
END;
$$;

-- Create user with role (for offline admin user creation)
CREATE OR REPLACE FUNCTION public.create_user_with_role(
    p_email text,
    p_password text,
    p_full_name text,
    p_role app_role,
    p_phone text DEFAULT NULL,
    p_license_number text DEFAULT NULL,
    p_license_expiry date DEFAULT NULL,
    p_repair_org_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_profile_id uuid;
BEGIN
    -- Create auth user
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_user_meta_data,
        role,
        aud
    ) VALUES (
        gen_random_uuid(),
        p_email,
        crypt(p_password, gen_salt('bf')),
        now(),
        jsonb_build_object('full_name', p_full_name),
        'authenticated',
        'authenticated'
    )
    RETURNING id INTO v_user_id;
    
    -- Create profile
    INSERT INTO public.profiles (user_id, full_name, phone, license_number, license_expiry, repair_org_id)
    VALUES (v_user_id, p_full_name, p_phone, p_license_number, p_license_expiry, p_repair_org_id)
    RETURNING id INTO v_profile_id;
    
    -- Assign role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, p_role);
    
    RETURN v_user_id;
END;
$$;

-- ===========================================
-- TRIGGERS
-- ===========================================

-- Auto-create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update expense total on status change
DROP TRIGGER IF EXISTS update_expense_total ON public.expenses;
CREATE TRIGGER update_expense_total
    AFTER UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.update_trip_total_expense();

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

-- Enable RLS on all tables
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_tax_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indian_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

-- Buses policies
CREATE POLICY "Admins can manage buses" ON public.buses FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can view buses" ON public.buses FOR SELECT USING (true);

-- Bus tax records policies
CREATE POLICY "Admins can manage tax records" ON public.bus_tax_records FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can view tax records" ON public.bus_tax_records FOR SELECT USING (true);

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Routes policies
CREATE POLICY "Authenticated users can view routes" ON public.routes FOR SELECT USING (true);
CREATE POLICY "Admins can manage routes" ON public.routes FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Bus schedules policies
CREATE POLICY "Authenticated users can view schedules" ON public.bus_schedules FOR SELECT USING (true);
CREATE POLICY "Admins can manage schedules" ON public.bus_schedules FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Trips policies
CREATE POLICY "Drivers can view their own trips" ON public.trips FOR SELECT USING (driver_id = get_profile_id(auth.uid()));
CREATE POLICY "Drivers can update odometer on their trips" ON public.trips FOR UPDATE USING (driver_id = get_profile_id(auth.uid()));
CREATE POLICY "Admins can view all trips" ON public.trips FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage trips" ON public.trips FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Expenses policies
CREATE POLICY "Drivers can view their own expenses" ON public.expenses FOR SELECT USING (submitted_by = get_profile_id(auth.uid()));
CREATE POLICY "Drivers can insert their own expenses" ON public.expenses FOR INSERT WITH CHECK (submitted_by = get_profile_id(auth.uid()));
CREATE POLICY "Drivers can update their pending expenses" ON public.expenses FOR UPDATE USING ((submitted_by = get_profile_id(auth.uid())) AND (status = 'pending'));
CREATE POLICY "Admins can view all expenses" ON public.expenses FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage all expenses" ON public.expenses FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Expense categories policies
CREATE POLICY "Authenticated users can view expense categories" ON public.expense_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage expense categories" ON public.expense_categories FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Indian states policies
CREATE POLICY "Anyone can view indian states" ON public.indian_states FOR SELECT USING (true);
CREATE POLICY "Admins can manage indian states" ON public.indian_states FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Service role can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Repair organizations policies
CREATE POLICY "Admins can manage repair organizations" ON public.repair_organizations FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Repair orgs can view their own organization" ON public.repair_organizations FOR SELECT 
    USING (id = (SELECT repair_org_id FROM profiles WHERE user_id = auth.uid()));

-- Repair records policies
CREATE POLICY "Admins can manage all repair records" ON public.repair_records FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Repair orgs can view their own records" ON public.repair_records FOR SELECT 
    USING (organization_id = (SELECT repair_org_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Repair orgs can insert their own records" ON public.repair_records FOR INSERT 
    WITH CHECK (organization_id = (SELECT repair_org_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Repair orgs can update their submitted records" ON public.repair_records FOR UPDATE 
    USING ((organization_id = (SELECT repair_org_id FROM profiles WHERE user_id = auth.uid())) AND (status = 'submitted'));

-- Admin settings policies
CREATE POLICY "Admins can view settings" ON public.admin_settings FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage settings" ON public.admin_settings FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Stock items policies
CREATE POLICY "Authenticated users can view stock items" ON public.stock_items FOR SELECT USING (true);
CREATE POLICY "Admins can manage stock items" ON public.stock_items FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers can update stock quantities" ON public.stock_items FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'driver'));

-- Stock transactions policies
CREATE POLICY "Authenticated users can view stock transactions" ON public.stock_transactions FOR SELECT USING (true);
CREATE POLICY "Admins can manage stock transactions" ON public.stock_transactions FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers can insert stock transactions" ON public.stock_transactions FOR INSERT 
    WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'driver'));

-- Invoices policies
CREATE POLICY "Admins can view all invoices" ON public.invoices FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage all invoices" ON public.invoices FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Invoice line items policies
CREATE POLICY "Admins can view all invoice line items" ON public.invoice_line_items FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage all invoice line items" ON public.invoice_line_items FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Invoice payments policies
CREATE POLICY "Admins can view all invoice payments" ON public.invoice_payments FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage all invoice payments" ON public.invoice_payments FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ===========================================
-- GRANT PERMISSIONS
-- ===========================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- ===========================================
-- SEED DATA
-- ===========================================

-- Insert default expense categories
INSERT INTO public.expense_categories (name, description, icon) VALUES
    ('Diesel', 'Diesel fuel expenses', 'Fuel'),
    ('Toll', 'Toll plaza charges', 'Receipt'),
    ('Food', 'Food and refreshments for driver', 'Utensils'),
    ('Repair', 'Vehicle repairs and maintenance', 'Wrench'),
    ('Traffic Fine', 'Traffic violations and penalties', 'AlertTriangle'),
    ('Parking', 'Parking charges', 'ParkingCircle'),
    ('Water', 'Water bottles/boxes for trips', 'Droplets'),
    ('Miscellaneous', 'Other expenses', 'MoreHorizontal')
ON CONFLICT DO NOTHING;

-- Insert Indian states
INSERT INTO public.indian_states (state_name, state_code, is_union_territory) VALUES
    ('Andhra Pradesh', 'AP', false),
    ('Arunachal Pradesh', 'AR', false),
    ('Assam', 'AS', false),
    ('Bihar', 'BR', false),
    ('Chhattisgarh', 'CG', false),
    ('Goa', 'GA', false),
    ('Gujarat', 'GJ', false),
    ('Haryana', 'HR', false),
    ('Himachal Pradesh', 'HP', false),
    ('Jharkhand', 'JH', false),
    ('Karnataka', 'KA', false),
    ('Kerala', 'KL', false),
    ('Madhya Pradesh', 'MP', false),
    ('Maharashtra', 'MH', false),
    ('Manipur', 'MN', false),
    ('Meghalaya', 'ML', false),
    ('Mizoram', 'MZ', false),
    ('Nagaland', 'NL', false),
    ('Odisha', 'OD', false),
    ('Punjab', 'PB', false),
    ('Rajasthan', 'RJ', false),
    ('Sikkim', 'SK', false),
    ('Tamil Nadu', 'TN', false),
    ('Telangana', 'TG', false),
    ('Tripura', 'TR', false),
    ('Uttar Pradesh', 'UP', false),
    ('Uttarakhand', 'UK', false),
    ('West Bengal', 'WB', false),
    ('Delhi', 'DL', true),
    ('Jammu and Kashmir', 'JK', true),
    ('Ladakh', 'LA', true),
    ('Chandigarh', 'CH', true),
    ('Puducherry', 'PY', true),
    ('Andaman and Nicobar', 'AN', true),
    ('Lakshadweep', 'LD', true),
    ('Dadra Nagar Haveli and Daman Diu', 'DN', true)
ON CONFLICT DO NOTHING;

-- Insert default admin settings
INSERT INTO public.admin_settings (key, value, description) VALUES
    ('gst_percentage', '18', 'Default GST percentage for revenue calculations'),
    ('fuel_price_per_liter', '90', 'Default fuel price per liter for efficiency calculations'),
    ('company_name', 'Fleet Manager', 'Company name for invoices and reports'),
    ('company_address', '', 'Company address for invoices'),
    ('company_gst', '', 'Company GST number'),
    ('company_phone', '', 'Company phone number')
ON CONFLICT (key) DO NOTHING;

-- Insert default stock items
INSERT INTO public.stock_items (item_name, quantity, unit, low_stock_threshold, notes) VALUES
    ('Water Bottles (1L)', 100, 'pieces', 50, 'Standard 1 liter water bottles'),
    ('Water Boxes (20L)', 20, 'pieces', 10, 'Large water boxes for trips')
ON CONFLICT DO NOTHING;

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
    ('expense-documents', 'expense-documents', false),
    ('repair-photos', 'repair-photos', true)
ON CONFLICT DO NOTHING;

-- Storage policies
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can upload expense documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'expense-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view their expense documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'expense-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Repair photos are public"
ON storage.objects FOR SELECT
USING (bucket_id = 'repair-photos');

CREATE POLICY "Authenticated users can upload repair photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'repair-photos' AND auth.role() = 'authenticated');

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ===========================================
-- CREATE DEFAULT ADMIN USER
-- ===========================================
-- Run this after setup to create your first admin:
-- SELECT create_user_with_role('admin@example.com', 'admin123', 'Admin User', 'admin');
