-- Create invoice direction enum (sales = outgoing, purchase = incoming)
CREATE TYPE public.invoice_direction AS ENUM ('sales', 'purchase');

-- Create invoice category enum for categorization
CREATE TYPE public.invoice_category AS ENUM (
  'general',
  'fuel',
  'repairs',
  'spares',
  'office_supplies',
  'insurance',
  'permits',
  'tolls',
  'other'
);

-- Add direction and category columns to invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS direction public.invoice_direction DEFAULT 'sales',
  ADD COLUMN IF NOT EXISTS category public.invoice_category DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS vendor_name TEXT,
  ADD COLUMN IF NOT EXISTS vendor_gst TEXT,
  ADD COLUMN IF NOT EXISTS vendor_address TEXT,
  ADD COLUMN IF NOT EXISTS vendor_phone TEXT;

-- Create index for faster filtering by direction
CREATE INDEX IF NOT EXISTS idx_invoices_direction ON public.invoices(direction);
CREATE INDEX IF NOT EXISTS idx_invoices_category ON public.invoices(category);