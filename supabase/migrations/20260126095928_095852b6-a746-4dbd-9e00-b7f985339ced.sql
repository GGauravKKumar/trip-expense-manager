-- Add trip linking columns to trips table
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS previous_trip_id UUID REFERENCES public.trips(id);
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS next_trip_id UUID REFERENCES public.trips(id);
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cycle_position INTEGER DEFAULT 1;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS expected_arrival_date DATE;

-- Add overnight journey fields to bus_schedules table
ALTER TABLE public.bus_schedules ADD COLUMN IF NOT EXISTS is_overnight BOOLEAN DEFAULT false;
ALTER TABLE public.bus_schedules ADD COLUMN IF NOT EXISTS arrival_next_day BOOLEAN DEFAULT false;
ALTER TABLE public.bus_schedules ADD COLUMN IF NOT EXISTS turnaround_hours NUMERIC DEFAULT 3;

-- Create index for trip chain lookups
CREATE INDEX IF NOT EXISTS idx_trips_previous_trip ON public.trips(previous_trip_id);
CREATE INDEX IF NOT EXISTS idx_trips_next_trip ON public.trips(next_trip_id);
CREATE INDEX IF NOT EXISTS idx_trips_schedule_date ON public.trips(schedule_id, trip_date);