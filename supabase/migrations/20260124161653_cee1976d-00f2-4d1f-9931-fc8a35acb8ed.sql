-- Add schedule-related columns to trips table
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES public.bus_schedules(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS trip_date date,
ADD COLUMN IF NOT EXISTS departure_time time,
ADD COLUMN IF NOT EXISTS arrival_time time,
ADD COLUMN IF NOT EXISTS return_departure_time time,
ADD COLUMN IF NOT EXISTS return_arrival_time time;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_trips_schedule_id ON public.trips(schedule_id);
CREATE INDEX IF NOT EXISTS idx_trips_trip_date ON public.trips(trip_date);

-- Add comment for clarity
COMMENT ON COLUMN public.trips.schedule_id IS 'Reference to bus_schedule that generated this trip (null for manually created trips)';
COMMENT ON COLUMN public.trips.trip_date IS 'The date of the trip (for scheduled trips)';
COMMENT ON COLUMN public.trips.departure_time IS 'Scheduled departure time';
COMMENT ON COLUMN public.trips.arrival_time IS 'Scheduled arrival time';
COMMENT ON COLUMN public.trips.return_departure_time IS 'Return journey departure time (for two-way trips)';
COMMENT ON COLUMN public.trips.return_arrival_time IS 'Return journey arrival time (for two-way trips)';