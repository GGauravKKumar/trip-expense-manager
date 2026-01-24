-- Phase 1: Comprehensive Database Migration for Enhanced Fleet Management

-- Create ownership_type enum
CREATE TYPE public.ownership_type AS ENUM ('owned', 'partnership');

-- Create stock_transaction_type enum
CREATE TYPE public.stock_transaction_type AS ENUM ('add', 'remove', 'adjustment');

-- Create tax_status enum
CREATE TYPE public.tax_status AS ENUM ('pending', 'paid', 'overdue');

-- =====================================================
-- Part 1: Bus Ownership & Tax - Modify buses table
-- =====================================================
ALTER TABLE public.buses
ADD COLUMN ownership_type ownership_type NOT NULL DEFAULT 'owned',
ADD COLUMN partner_name text,
ADD COLUMN company_profit_share numeric NOT NULL DEFAULT 100,
ADD COLUMN partner_profit_share numeric NOT NULL DEFAULT 0,
ADD COLUMN home_state_id uuid REFERENCES public.indian_states(id),
ADD COLUMN monthly_tax_amount numeric DEFAULT 0,
ADD COLUMN tax_due_day integer DEFAULT 1 CHECK (tax_due_day >= 1 AND tax_due_day <= 28),
ADD COLUMN last_tax_paid_date date,
ADD COLUMN next_tax_due_date date;

-- Add constraint to ensure profit shares total 100
ALTER TABLE public.buses
ADD CONSTRAINT profit_shares_total_100 CHECK (company_profit_share + partner_profit_share = 100);

-- =====================================================
-- Part 2: Enhanced Revenue with GST - Modify trips table
-- =====================================================
ALTER TABLE public.trips
ADD COLUMN revenue_agent numeric DEFAULT 0,
ADD COLUMN gst_percentage numeric DEFAULT 18,
ADD COLUMN return_revenue_agent numeric DEFAULT 0;

-- =====================================================
-- Part 3: Bus Schedules Table
-- =====================================================
CREATE TABLE public.bus_schedules (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    bus_id uuid REFERENCES public.buses(id) ON DELETE CASCADE NOT NULL,
    route_id uuid REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
    driver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    departure_time time NOT NULL,
    arrival_time time NOT NULL,
    days_of_week text[] NOT NULL DEFAULT '{}',
    is_two_way boolean NOT NULL DEFAULT true,
    return_departure_time time,
    return_arrival_time time,
    is_active boolean NOT NULL DEFAULT true,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on bus_schedules
ALTER TABLE public.bus_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies for bus_schedules
CREATE POLICY "Admins can manage schedules"
ON public.bus_schedules
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view schedules"
ON public.bus_schedules
FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_bus_schedules_updated_at
BEFORE UPDATE ON public.bus_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Part 4: Stock Management Tables
-- =====================================================
CREATE TABLE public.stock_items (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    item_name text NOT NULL,
    quantity integer NOT NULL DEFAULT 0,
    low_stock_threshold integer NOT NULL DEFAULT 50,
    unit text NOT NULL DEFAULT 'pieces',
    notes text,
    last_updated_by uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on stock_items
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock_items
CREATE POLICY "Admins can manage stock items"
ON public.stock_items
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view stock items"
ON public.stock_items
FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_stock_items_updated_at
BEFORE UPDATE ON public.stock_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Stock transactions table for history
CREATE TABLE public.stock_transactions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_item_id uuid REFERENCES public.stock_items(id) ON DELETE CASCADE NOT NULL,
    transaction_type stock_transaction_type NOT NULL,
    quantity_change integer NOT NULL,
    previous_quantity integer NOT NULL,
    new_quantity integer NOT NULL,
    notes text,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on stock_transactions
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock_transactions
CREATE POLICY "Admins can manage stock transactions"
ON public.stock_transactions
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view stock transactions"
ON public.stock_transactions
FOR SELECT
USING (true);

-- =====================================================
-- Part 5: Bus Tax Records Table (for payment history)
-- =====================================================
CREATE TABLE public.bus_tax_records (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    bus_id uuid REFERENCES public.buses(id) ON DELETE CASCADE NOT NULL,
    tax_period_start date NOT NULL,
    tax_period_end date NOT NULL,
    amount numeric NOT NULL,
    due_date date NOT NULL,
    paid_date date,
    payment_reference text,
    status tax_status NOT NULL DEFAULT 'pending',
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on bus_tax_records
ALTER TABLE public.bus_tax_records ENABLE ROW LEVEL SECURITY;

-- RLS policies for bus_tax_records
CREATE POLICY "Admins can manage tax records"
ON public.bus_tax_records
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view tax records"
ON public.bus_tax_records
FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_bus_tax_records_updated_at
BEFORE UPDATE ON public.bus_tax_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Part 6: Add new admin settings
-- =====================================================
INSERT INTO public.admin_settings (key, value, description) VALUES
('low_stock_alert_threshold', '50', 'Minimum stock quantity before showing alerts'),
('stock_alert_email', '', 'Email address for stock alert notifications'),
('tax_alert_days', '7', 'Days before tax due date to show alerts'),
('gst_percentage', '18', 'Default GST percentage for revenue calculations'),
('smtp_host', '', 'SMTP server host for email notifications'),
('smtp_port', '587', 'SMTP server port'),
('admin_alert_email', '', 'Admin email for receiving system alerts')
ON CONFLICT (key) DO NOTHING;