-- BusManager Database Initialization Script for Python Backend
-- This script sets up the complete database schema for Python API deployment
-- Simplified version without Supabase-specific features (RLS, auth schema triggers)

-- ===========================================
-- EXTENSIONS
-- ===========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===========================================
-- SCHEMAS
-- ===========================================
CREATE SCHEMA IF NOT EXISTS auth;

-- ===========================================
-- AUTH SCHEMA (simplified for Python backend)
-- ===========================================
CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    encrypted_password text NOT NULL,
    email_confirmed_at timestamptz DEFAULT now(),
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

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
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_direction') THEN
        CREATE TYPE public.invoice_direction AS ENUM ('sales', 'purchase');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_category') THEN
        CREATE TYPE public.invoice_category AS ENUM ('general', 'fuel', 'repairs', 'spares', 'office_supplies', 'insurance', 'permits', 'tolls', 'other');
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
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
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
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
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
    bus_id uuid NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
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
    bus_id uuid NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    route_id uuid NOT NULL REFERENCES routes(id),
    driver_id uuid REFERENCES profiles(id),
    days_of_week text[] NOT NULL DEFAULT '{}',
    departure_time time NOT NULL,
    arrival_time time NOT NULL,
    is_two_way boolean NOT NULL DEFAULT true,
    return_departure_time time,
    return_arrival_time time,
    is_active boolean NOT NULL DEFAULT true,
    is_overnight boolean DEFAULT false,
    arrival_next_day boolean DEFAULT false,
    turnaround_hours numeric DEFAULT 3,
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
    expected_arrival_date date,
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
    -- Trip chain
    previous_trip_id uuid,
    next_trip_id uuid,
    cycle_position integer DEFAULT 1,
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
    trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
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
    gst_applicable boolean DEFAULT true,
    gst_percentage numeric DEFAULT 18,
    gst_amount numeric DEFAULT 0,
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
    gst_percentage numeric DEFAULT 0,
    low_stock_threshold integer NOT NULL DEFAULT 50,
    notes text,
    last_updated_by uuid REFERENCES profiles(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Stock Transactions table
CREATE TABLE IF NOT EXISTS public.stock_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_item_id uuid NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
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
    direction invoice_direction DEFAULT 'sales',
    category invoice_category DEFAULT 'general',
    customer_name text NOT NULL,
    customer_address text,
    customer_phone text,
    customer_gst text,
    vendor_name text,
    vendor_address text,
    vendor_phone text,
    vendor_gst text,
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
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL DEFAULT 'info',
    read boolean NOT NULL DEFAULT false,
    link text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Security Audit Log table
CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid,
    details jsonb,
    ip_address text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ===========================================
-- TRIGGERS
-- ===========================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Apply update triggers to relevant tables
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'buses', 'bus_tax_records', 'profiles', 'routes', 'bus_schedules',
        'trips', 'expenses', 'repair_records', 'admin_settings',
        'stock_items', 'invoices', 'repair_organizations'
    ])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%s', t, t);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
    END LOOP;
END
$$;

-- Update trip total expense when expense status changes
CREATE OR REPLACE FUNCTION public.update_trip_total_expense()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        UPDATE public.trips SET total_expense = COALESCE(total_expense, 0) + NEW.amount WHERE id = NEW.trip_id;
    ELSIF OLD.status = 'approved' AND NEW.status != 'approved' THEN
        UPDATE public.trips SET total_expense = COALESCE(total_expense, 0) - OLD.amount WHERE id = NEW.trip_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_expense_total ON public.expenses;
CREATE TRIGGER update_expense_total
    AFTER UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.update_trip_total_expense();

-- ===========================================
-- HELPER FUNCTIONS
-- ===========================================

-- Create user with role (for admin user creation)
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
        raw_user_meta_data
    ) VALUES (
        gen_random_uuid(),
        p_email,
        crypt(p_password, gen_salt('bf')),
        now(),
        jsonb_build_object('full_name', p_full_name)
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
    ('company_name', 'BusManager', 'Company name for invoices and reports'),
    ('company_address', '', 'Company address for invoices'),
    ('company_gst', '', 'Company GST number'),
    ('company_phone', '', 'Company phone number')
ON CONFLICT (key) DO NOTHING;

-- Insert default stock items
INSERT INTO public.stock_items (item_name, quantity, unit, low_stock_threshold, notes) VALUES
    ('Water Bottles (1L)', 100, 'pieces', 50, 'Standard 1 liter water bottles'),
    ('Water Boxes (20L)', 20, 'pieces', 10, 'Large water boxes for trips')
ON CONFLICT DO NOTHING;

-- ===========================================
-- CREATE DEFAULT ADMIN USER
-- ===========================================
-- Run this after setup to create your first admin:
-- SELECT create_user_with_role('admin@example.com', 'admin123', 'Admin User', 'admin');
