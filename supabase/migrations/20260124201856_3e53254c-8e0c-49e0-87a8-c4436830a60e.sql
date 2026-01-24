-- Add GST columns to invoice_line_items
ALTER TABLE public.invoice_line_items
ADD COLUMN IF NOT EXISTS gst_percentage numeric NOT NULL DEFAULT 18,
ADD COLUMN IF NOT EXISTS rate_includes_gst boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS base_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS gst_amount numeric NOT NULL DEFAULT 0;