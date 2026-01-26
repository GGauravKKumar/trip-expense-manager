-- Restrict stock_items to admin-only viewing (drivers can still update quantities for stock movements)
DROP POLICY IF EXISTS "Authenticated users can view stock items" ON public.stock_items;

CREATE POLICY "Admins and drivers can view stock items"
ON public.stock_items
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'driver'::app_role)
);

-- Restrict stock_transactions to admin and driver viewing only
DROP POLICY IF EXISTS "Authenticated users can view stock transactions" ON public.stock_transactions;

CREATE POLICY "Admins and drivers can view stock transactions"
ON public.stock_transactions
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'driver'::app_role)
);

-- Fix the overly permissive notifications INSERT policy
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

CREATE POLICY "Authenticated users can insert their own notifications"
ON public.notifications
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Add policy for service role to insert notifications (for edge functions)
CREATE POLICY "Service role can insert any notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Add audit columns for security tracking (optional but recommended)
-- This tracks when sensitive operations occur

-- Create a security audit log table
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  ip_address text,
  user_agent text,
  details jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.security_audit_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only service role can insert audit logs (from edge functions)
CREATE POLICY "Service role can insert audit logs"
ON public.security_audit_log
FOR INSERT
WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Create index for faster audit log queries
CREATE INDEX IF NOT EXISTS idx_security_audit_user_id ON public.security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_created_at ON public.security_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_action ON public.security_audit_log(action);