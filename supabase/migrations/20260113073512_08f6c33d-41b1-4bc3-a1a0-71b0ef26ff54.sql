-- Add odometer and revenue tracking fields to trips table
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS odometer_start numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS odometer_end numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS distance_traveled numeric GENERATED ALWAYS AS (
  CASE WHEN odometer_end IS NOT NULL AND odometer_start IS NOT NULL 
  THEN odometer_end - odometer_start 
  ELSE NULL END
) STORED,
ADD COLUMN IF NOT EXISTS revenue_cash numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS revenue_online numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS revenue_paytm numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS revenue_others numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_revenue numeric GENERATED ALWAYS AS (
  COALESCE(revenue_cash, 0) + COALESCE(revenue_online, 0) + COALESCE(revenue_paytm, 0) + COALESCE(revenue_others, 0)
) STORED;

-- Allow drivers to update odometer readings on their trips
CREATE POLICY "Drivers can update odometer on their trips"
ON public.trips
FOR UPDATE
USING (driver_id = get_profile_id(auth.uid()))
WITH CHECK (driver_id = get_profile_id(auth.uid()));