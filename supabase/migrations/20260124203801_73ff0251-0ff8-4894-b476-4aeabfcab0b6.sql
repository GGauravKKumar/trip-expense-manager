-- Fix total_revenue generated column to include revenue_agent
ALTER TABLE public.trips 
DROP COLUMN total_revenue;

ALTER TABLE public.trips 
ADD COLUMN total_revenue numeric GENERATED ALWAYS AS (
  COALESCE(revenue_cash, 0) + 
  COALESCE(revenue_online, 0) + 
  COALESCE(revenue_paytm, 0) + 
  COALESCE(revenue_others, 0) + 
  COALESCE(revenue_agent, 0)
) STORED;