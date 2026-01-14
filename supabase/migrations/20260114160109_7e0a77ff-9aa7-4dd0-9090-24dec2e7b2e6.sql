-- Add columns for two-way trip support (outward and return journey tracking)

-- Outward journey fields (rename existing fields to be more explicit)
ALTER TABLE public.trips 
  ADD COLUMN trip_type text NOT NULL DEFAULT 'one_way' CHECK (trip_type IN ('one_way', 'two_way')),
  -- Return journey odometer
  ADD COLUMN odometer_return_start numeric,
  ADD COLUMN odometer_return_end numeric,
  ADD COLUMN distance_return numeric,
  -- Return journey revenue
  ADD COLUMN return_revenue_cash numeric DEFAULT 0,
  ADD COLUMN return_revenue_online numeric DEFAULT 0,
  ADD COLUMN return_revenue_paytm numeric DEFAULT 0,
  ADD COLUMN return_revenue_others numeric DEFAULT 0,
  ADD COLUMN return_total_revenue numeric DEFAULT 0,
  -- Return journey expense
  ADD COLUMN return_total_expense numeric DEFAULT 0;