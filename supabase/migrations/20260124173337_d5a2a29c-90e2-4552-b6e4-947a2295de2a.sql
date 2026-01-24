-- Allow drivers to insert stock transactions (for water pickup)
CREATE POLICY "Drivers can insert stock transactions"
ON public.stock_transactions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'driver'
  )
);

-- Allow drivers to update stock item quantities
CREATE POLICY "Drivers can update stock quantities"
ON public.stock_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'driver'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'driver'
  )
);