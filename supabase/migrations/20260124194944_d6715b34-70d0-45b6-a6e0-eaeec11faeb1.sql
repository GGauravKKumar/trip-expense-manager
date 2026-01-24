-- Add fuel_quantity column to expenses table for tracking liters of fuel
ALTER TABLE public.expenses 
ADD COLUMN fuel_quantity numeric DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.expenses.fuel_quantity IS 'Quantity of fuel in liters (only for fuel/diesel expenses)';