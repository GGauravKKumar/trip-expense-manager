// Invoice Types and Interfaces

export type InvoiceType = 'customer' | 'online_app' | 'charter';
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled';
export type InvoiceDirection = 'sales' | 'purchase';
export type InvoiceCategory = 
  | 'general'
  | 'fuel'
  | 'repairs'
  | 'spares'
  | 'office_supplies'
  | 'insurance'
  | 'permits'
  | 'tolls'
  | 'other';

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  // Direction: sales (outgoing to customers) or purchase (incoming from vendors)
  direction: InvoiceDirection;
  category: InvoiceCategory;
  // Customer details (for sales invoices)
  customer_name: string;
  customer_address: string | null;
  customer_phone: string | null;
  customer_gst: string | null;
  // Vendor details (for purchase invoices)
  vendor_name: string | null;
  vendor_address: string | null;
  vendor_phone: string | null;
  vendor_gst: string | null;
  // Invoice type (customer, online_app, charter)
  invoice_type: InvoiceType;
  trip_id: string | null;
  bus_id: string | null;
  // Amounts
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: InvoiceStatus;
  notes: string | null;
  terms: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  is_deduction: boolean;
  gst_percentage: number;
  rate_includes_gst: boolean;
  base_amount: number;
  gst_amount: number;
  created_at: string;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_mode: string;
  reference_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export const INVOICE_CATEGORIES: { value: InvoiceCategory; label: string; description: string }[] = [
  { value: 'general', label: 'General', description: 'General purpose invoices' },
  { value: 'fuel', label: 'Fuel', description: 'Diesel, petrol bills' },
  { value: 'repairs', label: 'Repairs', description: 'Vehicle repairs and maintenance' },
  { value: 'spares', label: 'Spares & Parts', description: 'Spare parts and accessories' },
  { value: 'office_supplies', label: 'Office Supplies', description: 'Office stationery, consumables' },
  { value: 'insurance', label: 'Insurance', description: 'Vehicle and other insurance' },
  { value: 'permits', label: 'Permits & Taxes', description: 'Road permits, vehicle taxes' },
  { value: 'tolls', label: 'Tolls', description: 'Toll charges and FASTags' },
  { value: 'other', label: 'Other', description: 'Miscellaneous expenses' },
];

export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { 
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
  label: string;
}> = {
  draft: { variant: 'secondary', className: '', label: 'Draft' },
  sent: { variant: 'outline', className: '', label: 'Sent' },
  partial: { variant: 'default', className: 'bg-yellow-500 hover:bg-yellow-600', label: 'Partial' },
  paid: { variant: 'default', className: 'bg-green-500 hover:bg-green-600', label: 'Paid' },
  overdue: { variant: 'destructive', className: '', label: 'Overdue' },
  cancelled: { variant: 'destructive', className: '', label: 'Cancelled' },
};
