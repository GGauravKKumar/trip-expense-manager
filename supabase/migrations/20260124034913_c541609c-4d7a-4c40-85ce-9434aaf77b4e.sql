-- Add snapshot columns to preserve historical data when bus/driver is deleted
ALTER TABLE public.trips 
ADD COLUMN bus_name_snapshot TEXT,
ADD COLUMN driver_name_snapshot TEXT;

-- Make bus_id nullable (so we can keep trip records after bus deletion)
ALTER TABLE public.trips ALTER COLUMN bus_id DROP NOT NULL;

-- Make driver_id nullable (so we can keep trip records after driver deletion)
ALTER TABLE public.trips ALTER COLUMN driver_id DROP NOT NULL;

-- Drop existing foreign key constraints and recreate with ON DELETE SET NULL
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_bus_id_fkey;
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_driver_id_fkey;

ALTER TABLE public.trips 
ADD CONSTRAINT trips_bus_id_fkey 
FOREIGN KEY (bus_id) REFERENCES public.buses(id) ON DELETE SET NULL;

ALTER TABLE public.trips 
ADD CONSTRAINT trips_driver_id_fkey 
FOREIGN KEY (driver_id) REFERENCES public.profiles(id) ON DELETE SET NULL;