-- Add repair_org role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'repair_org';

-- Create repair organizations table
CREATE TABLE public.repair_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_code text NOT NULL UNIQUE,
  org_name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create repair records table
CREATE TABLE public.repair_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_number text NOT NULL UNIQUE,
  organization_id uuid NOT NULL REFERENCES repair_organizations(id),
  bus_id uuid REFERENCES buses(id),
  bus_registration text NOT NULL,
  repair_date date NOT NULL DEFAULT CURRENT_DATE,
  repair_type text NOT NULL CHECK (repair_type IN ('resole', 'new', 'repair')),
  description text NOT NULL,
  parts_changed text,
  labor_cost numeric DEFAULT 0,
  parts_cost numeric DEFAULT 0,
  total_cost numeric GENERATED ALWAYS AS (labor_cost + parts_cost) STORED,
  photo_before_url text,
  photo_after_url text,
  warranty_days integer DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected', 'completed')),
  submitted_by uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Link repair org users to their organization
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS repair_org_id uuid REFERENCES repair_organizations(id);

-- Enable RLS
ALTER TABLE public.repair_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for repair_organizations
CREATE POLICY "Admins can manage repair organizations"
  ON public.repair_organizations FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Repair orgs can view their own organization"
  ON public.repair_organizations FOR SELECT
  USING (
    id = (SELECT repair_org_id FROM profiles WHERE user_id = auth.uid())
  );

-- RLS Policies for repair_records
CREATE POLICY "Admins can manage all repair records"
  ON public.repair_records FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Repair orgs can view their own records"
  ON public.repair_records FOR SELECT
  USING (
    organization_id = (SELECT repair_org_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Repair orgs can insert their own records"
  ON public.repair_records FOR INSERT
  WITH CHECK (
    organization_id = (SELECT repair_org_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Repair orgs can update their submitted records"
  ON public.repair_records FOR UPDATE
  USING (
    organization_id = (SELECT repair_org_id FROM profiles WHERE user_id = auth.uid())
    AND status = 'submitted'
  )
  WITH CHECK (
    organization_id = (SELECT repair_org_id FROM profiles WHERE user_id = auth.uid())
    AND status = 'submitted'
  );

-- Create storage bucket for repair photos
INSERT INTO storage.buckets (id, name, public) VALUES ('repair-photos', 'repair-photos', true);

-- Storage policies for repair photos
CREATE POLICY "Anyone can view repair photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'repair-photos');

CREATE POLICY "Authenticated users can upload repair photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'repair-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own repair photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'repair-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add triggers for updated_at
CREATE TRIGGER update_repair_organizations_updated_at
  BEFORE UPDATE ON public.repair_organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repair_records_updated_at
  BEFORE UPDATE ON public.repair_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();