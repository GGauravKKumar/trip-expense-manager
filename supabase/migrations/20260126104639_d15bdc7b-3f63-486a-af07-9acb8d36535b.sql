-- Add GST fields to repair_records table
ALTER TABLE public.repair_records 
  ADD COLUMN IF NOT EXISTS gst_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_applicable BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC DEFAULT 18;

-- Add GST rate field to stock_items table
ALTER TABLE public.stock_items 
  ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC DEFAULT 0;