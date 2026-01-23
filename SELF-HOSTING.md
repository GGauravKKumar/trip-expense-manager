# Self-Hosting Guide - Fleet Manager

This guide explains how to run Fleet Manager on your own infrastructure.

## Prerequisites

1. **Node.js 18+** - For running the frontend
2. **Docker & Docker Compose** - For self-hosted Supabase
3. **Git** - For cloning the repository

---

## Step 1: Export/Clone the Code

Download or clone this project from Lovable:
- Go to Project Settings → Export → Download ZIP
- Or use GitHub integration to push to your repository

---

## Step 2: Set Up Self-Hosted Supabase

### Option A: Using Docker (Recommended)

```bash
# Clone Supabase Docker setup
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Copy environment template
cp .env.example .env

# Generate new secrets (IMPORTANT for security!)
# Edit .env and set:
# - POSTGRES_PASSWORD (strong password)
# - JWT_SECRET (min 32 chars)
# - ANON_KEY (generate at https://supabase.com/docs/guides/self-hosting#api-keys)
# - SERVICE_ROLE_KEY (generate at https://supabase.com/docs/guides/self-hosting#api-keys)

# Start Supabase
docker compose up -d
```

Supabase will be available at:
- **API URL**: http://localhost:8000
- **Studio (Dashboard)**: http://localhost:3000
- **Database**: postgres://postgres:your-password@localhost:5432/postgres

### Option B: Using Supabase CLI (Local Development)

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize and start
supabase init
supabase start
```

---

## Step 3: Set Up the Database

Run the following SQL in your Supabase SQL Editor (Studio → SQL Editor):

### 3.1 Create Enums

```sql
-- Create custom enums
CREATE TYPE public.app_role AS ENUM ('admin', 'driver');
CREATE TYPE public.bus_status AS ENUM ('active', 'maintenance', 'inactive');
CREATE TYPE public.expense_status AS ENUM ('pending', 'approved', 'denied');
CREATE TYPE public.trip_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
```

### 3.2 Create Tables

```sql
-- Buses table
CREATE TABLE public.buses (
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
CREATE TABLE public.indian_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    state_name text NOT NULL,
    state_code text NOT NULL,
    is_union_territory boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Profiles table
CREATE TABLE public.profiles (
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
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    role app_role NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Routes table
CREATE TABLE public.routes (
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
CREATE TABLE public.trips (
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
    -- Outward journey
    odometer_start numeric,
    odometer_end numeric,
    distance_traveled numeric,
    revenue_cash numeric DEFAULT 0,
    revenue_online numeric DEFAULT 0,
    revenue_paytm numeric DEFAULT 0,
    revenue_others numeric DEFAULT 0,
    total_revenue numeric,
    total_expense numeric DEFAULT 0,
    -- Return journey
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
CREATE TABLE public.expense_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    icon text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Expenses table
CREATE TABLE public.expenses (
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
CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL DEFAULT 'info',
    read boolean NOT NULL DEFAULT false,
    link text,
    created_at timestamptz NOT NULL DEFAULT now()
);
```

### 3.3 Create Database Functions

```sql
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
```

### 3.4 Create Triggers

```sql
-- Auto-create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update expense total on status change
CREATE TRIGGER update_expense_total
    AFTER UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.update_trip_total_expense();
```

### 3.5 Enable Row Level Security

```sql
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

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

### 3.6 Seed Initial Data

```sql
-- Insert default expense categories
INSERT INTO public.expense_categories (name, description, icon) VALUES
    ('Fuel', 'Diesel or Petrol expenses', 'Fuel'),
    ('Toll', 'Toll plaza charges', 'Receipt'),
    ('Food', 'Food and refreshments for driver', 'Utensils'),
    ('Repair', 'Vehicle repairs and maintenance', 'Wrench'),
    ('Traffic Fine', 'Traffic violations and penalties', 'AlertTriangle'),
    ('Parking', 'Parking charges', 'ParkingCircle'),
    ('Miscellaneous', 'Other expenses', 'MoreHorizontal');

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
    ('Dadra Nagar Haveli and Daman Diu', 'DN', true);
```

---

## Step 4: Create Storage Bucket

In Supabase Studio (http://localhost:3000):
1. Go to Storage
2. Create a new bucket named `expense-documents`
3. Set it to private (not public)
4. Add storage policies:

```sql
-- Allow authenticated users to upload to their folder
CREATE POLICY "Users can upload expense documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'expense-documents' AND auth.role() = 'authenticated');

-- Allow users to view their own documents
CREATE POLICY "Users can view their expense documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'expense-documents' AND auth.role() = 'authenticated');
```

---

## Step 5: Configure the Frontend

### 5.1 Update Environment Variables

Create or edit `.env` in the project root:

```env
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
VITE_SUPABASE_PROJECT_ID=local
```

### 5.2 Update Supabase Client

Edit `src/integrations/supabase/client.ts` if needed to use your local URL.

### 5.3 Install Dependencies and Run

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

---

## Step 6: Deploy Edge Functions (Optional)

If you want to use edge functions locally:

```bash
# Deploy edge functions to local Supabase
supabase functions serve

# Or deploy specific function
supabase functions serve check-trip-notifications
supabase functions serve create-driver
```

---

## Step 7: Create Admin User

1. Sign up through the app at http://localhost:5173/signup
2. In Supabase Studio SQL Editor, promote the user to admin:

```sql
-- Get your user ID from auth.users table first
SELECT id, email FROM auth.users;

-- Insert admin role (replace USER_ID with actual ID)
INSERT INTO public.user_roles (user_id, role) 
VALUES ('YOUR_USER_ID_HERE', 'admin');
```

---

## Production Deployment

For production self-hosting:

1. **Use proper SSL certificates** - Never run without HTTPS in production
2. **Set strong passwords** - Change all default passwords
3. **Configure backups** - Set up PostgreSQL backups
4. **Use reverse proxy** - Nginx or Traefik for load balancing
5. **Monitor resources** - Set up monitoring and alerts

### Docker Compose for Production

```yaml
version: '3.8'
services:
  frontend:
    build: .
    ports:
      - "80:80"
    environment:
      - VITE_SUPABASE_URL=https://your-domain.com
      - VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
    depends_on:
      - supabase
```

---

## Troubleshooting

### Common Issues

1. **Connection refused**: Ensure Docker is running and Supabase is started
2. **Authentication errors**: Verify JWT_SECRET and API keys match
3. **RLS blocking access**: Check user roles in user_roles table
4. **Edge functions not working**: Ensure Deno is installed for local functions

### Logs

```bash
# View Supabase logs
docker compose logs -f

# View specific service logs
docker compose logs -f postgres
docker compose logs -f kong
```

---

## Support

For issues with self-hosting:
- [Supabase Self-Hosting Docs](https://supabase.com/docs/guides/self-hosting)
- [Supabase GitHub Issues](https://github.com/supabase/supabase/issues)
