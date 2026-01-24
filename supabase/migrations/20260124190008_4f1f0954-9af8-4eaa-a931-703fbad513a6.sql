-- Add unit_price column to stock_items for cost tracking
ALTER TABLE public.stock_items 
ADD COLUMN IF NOT EXISTS unit_price numeric DEFAULT 0;

-- Add Water expense category if it doesn't exist
INSERT INTO public.expense_categories (name, description, icon)
VALUES ('Water', 'Water bottles/boxes for trips', 'Droplets')
ON CONFLICT DO NOTHING;