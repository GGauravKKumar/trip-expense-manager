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

export interface Trip {
  id: string;
  trip_number: string;
  bus_id: string;
  driver_id: string;
  route_id: string;
  start_date: string;
  end_date: string | null;
  status: TripStatus;
  notes: string | null;
  total_expense: number;
  created_at: string;
  updated_at: string;
  bus?: Bus;
  driver?: Profile;
  route?: Route;
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
