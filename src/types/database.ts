export type AppRole = 'admin' | 'driver';
export type TripStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type ExpenseStatus = 'pending' | 'approved' | 'denied';
export type BusStatus = 'active' | 'maintenance' | 'inactive';

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
  start_date: string;
  end_date: string | null;
  status: TripStatus;
  notes: string | null;
  trip_type: TripType;
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
  total_revenue: number | null;
  // Return journey
  odometer_return_start: number | null;
  odometer_return_end: number | null;
  distance_return: number | null;
  return_revenue_cash: number | null;
  return_revenue_online: number | null;
  return_revenue_paytm: number | null;
  return_revenue_others: number | null;
  return_total_revenue: number | null;
  return_total_expense: number | null;
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
