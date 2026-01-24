-- Add water_taken column to trips to track water picked up
ALTER TABLE public.trips 
ADD COLUMN water_taken integer DEFAULT 0;