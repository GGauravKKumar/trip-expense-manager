-- Fleet Manager Database Initialization Script
-- This script sets up the complete database schema for self-hosted deployment

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
        CREATE TYPE public.app_role AS ENUM ('admin', 'driver');
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
END
$$;

-- ===========================================
-- PUBLIC SCHEMA - TABLES
-- ===========================================

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
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indian States table
CREATE TABLE IF NOT EXISTS public.indian_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    state_name text NOT NULL,
    state_code text NOT NULL,
    is_union_territory boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
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

-- Trips table
CREATE TABLE IF NOT EXISTS public.trips (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_number text NOT NULL,
    bus_id uuid NOT NULL REFERENCES buses(id),
    driver_id uuid NOT NULL REFERENCES profiles(id),
    route_id uuid NOT NULL REFERENCES routes(id),
    start_date timestamptz NOT NULL,
    end_date timestamptz,
    status trip_status NOT NULL DEFAULT 'scheduled',
    trip_type text NOT NULL DEFAULT 'one_way',
    notes text,
    odometer_start numeric,
    odometer_end numeric,
    distance_traveled numeric,
    revenue_cash numeric DEFAULT 0,
    revenue_online numeric DEFAULT 0,
    revenue_paytm numeric DEFAULT 0,
    revenue_others numeric DEFAULT 0,
    total_revenue numeric,
    total_expense numeric DEFAULT 0,
    odometer_return_start numeric,
    odometer_return_end numeric,
    distance_return numeric,
    return_revenue_cash numeric DEFAULT 0,
    return_revenue_online numeric DEFAULT 0,
    return_revenue_paytm numeric DEFAULT 0,
    return_revenue_others numeric DEFAULT 0,
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
    status expense_status NOT NULL DEFAULT 'pending',
    admin_remarks text,
    approved_by uuid REFERENCES profiles(id),
    approved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
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
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indian_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Buses policies
CREATE POLICY "Admins can manage buses" ON public.buses FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can view buses" ON public.buses FOR SELECT USING (true);

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
    ('Fuel', 'Diesel or Petrol expenses', 'Fuel'),
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

-- Create storage bucket for expense documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-documents', 'expense-documents', false)
ON CONFLICT DO NOTHING;

-- Storage policies
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can upload expense documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'expense-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view their expense documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'expense-documents' AND auth.role() = 'authenticated');

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
