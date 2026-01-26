export type AppRole = 'admin' | 'driver' | 'repair_org';
export type TripStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type ExpenseStatus = 'pending' | 'approved' | 'denied';
export type BusStatus = 'active' | 'maintenance' | 'inactive';
export type OwnershipType = 'owned' | 'partnership';
export type StockTransactionType = 'add' | 'remove' | 'adjustment';
export type TaxStatus = 'pending' | 'paid' | 'overdue';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  license_number: string | null;
  license_expiry: string | null;
  address: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bus {
  id: string;
  registration_number: string;
  bus_name: string | null;
  capacity: number;
  bus_type: string;
  status: BusStatus;
  insurance_expiry: string | null;
  puc_expiry: string | null;
  fitness_expiry: string | null;
  // Ownership fields
  ownership_type: OwnershipType;
  partner_name: string | null;
  company_profit_share: number;
  partner_profit_share: number;
  // Tax fields
  home_state_id: string | null;
  monthly_tax_amount: number | null;
  tax_due_day: number | null;
  last_tax_paid_date: string | null;
  next_tax_due_date: string | null;
  home_state?: IndianState;
  created_at: string;
  updated_at: string;
}

export interface IndianState {
  id: string;
  state_name: string;
  state_code: string;
  is_union_territory: boolean;
  created_at: string;
}

export interface Route {
  id: string;
  route_name: string;
  from_state_id: string;
  to_state_id: string;
  from_address: string | null;
  to_address: string | null;
  distance_km: number | null;
  estimated_duration_hours: number | null;
  created_at: string;
  updated_at: string;
  from_state?: IndianState;
  to_state?: IndianState;
}

export type TripType = 'one_way' | 'two_way';

export interface Trip {
  id: string;
  trip_number: string;
  bus_id: string | null;
  driver_id: string | null;
  route_id: string;
  schedule_id: string | null;
  trip_date: string | null;
  start_date: string;
  end_date: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  return_departure_time: string | null;
  return_arrival_time: string | null;
  status: TripStatus;
  notes: string | null;
  trip_type: TripType;
  // Trip chain fields
  previous_trip_id: string | null;
  next_trip_id: string | null;
  cycle_position: number;
  expected_arrival_date: string | null;
  // Snapshot fields for deleted bus/driver
  bus_name_snapshot: string | null;
  driver_name_snapshot: string | null;
  // Outward journey
  total_expense: number;
  odometer_start: number | null;
  odometer_end: number | null;
  distance_traveled: number | null;
  revenue_cash: number | null;
  revenue_online: number | null;
  revenue_paytm: number | null;
  revenue_others: number | null;
  revenue_agent: number | null;
  total_revenue: number | null;
  gst_percentage: number | null;
  // Return journey
  odometer_return_start: number | null;
  odometer_return_end: number | null;
  distance_return: number | null;
  return_revenue_cash: number | null;
  return_revenue_online: number | null;
  return_revenue_paytm: number | null;
  return_revenue_others: number | null;
  return_revenue_agent: number | null;
  return_total_revenue: number | null;
  return_total_expense: number | null;
  // Water taken
  water_taken: number | null;
  created_at: string;
  updated_at: string;
  bus?: Bus | { registration_number: string; bus_name?: string | null } | null;
  driver?: Profile | { full_name: string } | null;
  route?: Route | { route_name: string; distance_km?: number | null; from_address?: string | null; to_address?: string | null };
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  category_id: string;
  submitted_by: string;
  amount: number;
  expense_date: string;
  description: string | null;
  document_url: string | null;
  status: ExpenseStatus;
  admin_remarks: string | null;
  approved_by: string | null;
  approved_at: string | null;
  fuel_quantity: number | null;
  created_at: string;
  updated_at: string;
  category?: ExpenseCategory;
  trip?: Trip;
  submitter?: Profile;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface BusSchedule {
  id: string;
  bus_id: string;
  route_id: string;
  driver_id: string | null;
  departure_time: string;
  arrival_time: string;
  days_of_week: string[];
  is_two_way: boolean;
  return_departure_time: string | null;
  return_arrival_time: string | null;
  is_active: boolean;
  notes: string | null;
  // Overnight journey fields
  is_overnight: boolean;
  arrival_next_day: boolean;
  turnaround_hours: number;
  created_at: string;
  updated_at: string;
  bus?: Bus;
  route?: Route;
  driver?: Profile;
}

export interface StockItem {
  id: string;
  item_name: string;
  quantity: number;
  low_stock_threshold: number;
  unit: string;
  unit_price: number | null;
  gst_percentage: number;
  notes: string | null;
  last_updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepairRecord {
  id: string;
  repair_number: string;
  organization_id: string;
  bus_id: string | null;
  bus_registration: string;
  repair_date: string;
  repair_type: string;
  description: string;
  parts_changed: string | null;
  labor_cost: number;
  parts_cost: number;
  total_cost: number;
  gst_amount: number;
  gst_applicable: boolean;
  gst_percentage: number;
  photo_before_url: string | null;
  photo_after_url: string | null;
  warranty_days: number;
  notes: string | null;
  status: string;
  submitted_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  repair_organizations?: {
    org_code: string;
    org_name: string;
  };
  buses?: {
    bus_name: string | null;
  };
}

export interface StockTransaction {
  id: string;
  stock_item_id: string;
  transaction_type: StockTransactionType;
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  stock_item?: StockItem;
}

export interface BusTaxRecord {
  id: string;
  bus_id: string;
  tax_period_start: string;
  tax_period_end: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  payment_reference: string | null;
  status: TaxStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  bus?: Bus;
}
