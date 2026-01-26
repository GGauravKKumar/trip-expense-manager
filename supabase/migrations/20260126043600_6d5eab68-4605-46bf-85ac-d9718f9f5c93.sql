-- Security Fix: Make repair-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'repair-photos';

-- Remove public access policy for repair photos
DROP POLICY IF EXISTS "Anyone can view repair photos" ON storage.objects;

-- Add authenticated-only access policy for repair photos
CREATE POLICY "Authenticated users can view repair photos" 
  ON storage.objects FOR SELECT
  USING (bucket_id = 'repair-photos' AND auth.role() = 'authenticated');

-- Security Fix: Create a view for non-admin users to access only non-sensitive bus data
CREATE OR REPLACE VIEW public.buses_driver_view
WITH (security_invoker = on) AS
SELECT 
  id,
  registration_number,
  bus_name,
  bus_type,
  capacity,
  status,
  insurance_expiry,
  puc_expiry,
  fitness_expiry,
  home_state_id,
  created_at,
  updated_at
FROM public.buses;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.buses_driver_view TO authenticated;

-- Update buses RLS: Remove open authenticated access, only admins can view full table
DROP POLICY IF EXISTS "Authenticated users can view buses" ON public.buses;

-- Ensure admins can still view all bus data (policy may already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'buses' AND policyname = 'Admins can view all bus data'
  ) THEN
    CREATE POLICY "Admins can view all bus data" ON public.buses FOR SELECT
      USING (has_role(auth.uid(), 'admin'));
  END IF;
END $$;