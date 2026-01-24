export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      bus_schedules: {
        Row: {
          arrival_time: string
          bus_id: string
          created_at: string
          days_of_week: string[]
          departure_time: string
          driver_id: string | null
          id: string
          is_active: boolean
          is_two_way: boolean
          notes: string | null
          return_arrival_time: string | null
          return_departure_time: string | null
          route_id: string
          updated_at: string
        }
        Insert: {
          arrival_time: string
          bus_id: string
          created_at?: string
          days_of_week?: string[]
          departure_time: string
          driver_id?: string | null
          id?: string
          is_active?: boolean
          is_two_way?: boolean
          notes?: string | null
          return_arrival_time?: string | null
          return_departure_time?: string | null
          route_id: string
          updated_at?: string
        }
        Update: {
          arrival_time?: string
          bus_id?: string
          created_at?: string
          days_of_week?: string[]
          departure_time?: string
          driver_id?: string | null
          id?: string
          is_active?: boolean
          is_two_way?: boolean
          notes?: string | null
          return_arrival_time?: string | null
          return_departure_time?: string | null
          route_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_schedules_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_schedules_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_schedules_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_tax_records: {
        Row: {
          amount: number
          bus_id: string
          created_at: string
          due_date: string
          id: string
          notes: string | null
          paid_date: string | null
          payment_reference: string | null
          status: Database["public"]["Enums"]["tax_status"]
          tax_period_end: string
          tax_period_start: string
          updated_at: string
        }
        Insert: {
          amount: number
          bus_id: string
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["tax_status"]
          tax_period_end: string
          tax_period_start: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bus_id?: string
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["tax_status"]
          tax_period_end?: string
          tax_period_start?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_tax_records_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
        ]
      }
      buses: {
        Row: {
          bus_name: string | null
          bus_type: string | null
          capacity: number
          company_profit_share: number
          created_at: string
          fitness_expiry: string | null
          home_state_id: string | null
          id: string
          insurance_expiry: string | null
          last_tax_paid_date: string | null
          monthly_tax_amount: number | null
          next_tax_due_date: string | null
          ownership_type: Database["public"]["Enums"]["ownership_type"]
          partner_name: string | null
          partner_profit_share: number
          puc_expiry: string | null
          registration_number: string
          status: Database["public"]["Enums"]["bus_status"]
          tax_due_day: number | null
          updated_at: string
        }
        Insert: {
          bus_name?: string | null
          bus_type?: string | null
          capacity?: number
          company_profit_share?: number
          created_at?: string
          fitness_expiry?: string | null
          home_state_id?: string | null
          id?: string
          insurance_expiry?: string | null
          last_tax_paid_date?: string | null
          monthly_tax_amount?: number | null
          next_tax_due_date?: string | null
          ownership_type?: Database["public"]["Enums"]["ownership_type"]
          partner_name?: string | null
          partner_profit_share?: number
          puc_expiry?: string | null
          registration_number: string
          status?: Database["public"]["Enums"]["bus_status"]
          tax_due_day?: number | null
          updated_at?: string
        }
        Update: {
          bus_name?: string | null
          bus_type?: string | null
          capacity?: number
          company_profit_share?: number
          created_at?: string
          fitness_expiry?: string | null
          home_state_id?: string | null
          id?: string
          insurance_expiry?: string | null
          last_tax_paid_date?: string | null
          monthly_tax_amount?: number | null
          next_tax_due_date?: string | null
          ownership_type?: Database["public"]["Enums"]["ownership_type"]
          partner_name?: string | null
          partner_profit_share?: number
          puc_expiry?: string | null
          registration_number?: string
          status?: Database["public"]["Enums"]["bus_status"]
          tax_due_day?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buses_home_state_id_fkey"
            columns: ["home_state_id"]
            isOneToOne: false
            referencedRelation: "indian_states"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          admin_remarks: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          category_id: string
          created_at: string
          description: string | null
          document_url: string | null
          expense_date: string
          id: string
          status: Database["public"]["Enums"]["expense_status"]
          submitted_by: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          admin_remarks?: string | null
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category_id: string
          created_at?: string
          description?: string | null
          document_url?: string | null
          expense_date?: string
          id?: string
          status?: Database["public"]["Enums"]["expense_status"]
          submitted_by: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          admin_remarks?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string
          created_at?: string
          description?: string | null
          document_url?: string | null
          expense_date?: string
          id?: string
          status?: Database["public"]["Enums"]["expense_status"]
          submitted_by?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      indian_states: {
        Row: {
          created_at: string
          id: string
          is_union_territory: boolean | null
          state_code: string
          state_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_union_territory?: boolean | null
          state_code: string
          state_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_union_territory?: boolean | null
          state_code?: string
          state_name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          license_expiry: string | null
          license_number: string | null
          phone: string | null
          repair_org_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          license_expiry?: string | null
          license_number?: string | null
          phone?: string | null
          repair_org_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          license_expiry?: string | null
          license_number?: string | null
          phone?: string | null
          repair_org_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_repair_org_id_fkey"
            columns: ["repair_org_id"]
            isOneToOne: false
            referencedRelation: "repair_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_organizations: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          org_code: string
          org_name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          org_code: string
          org_name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          org_code?: string
          org_name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      repair_records: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bus_id: string | null
          bus_registration: string
          created_at: string
          description: string
          id: string
          labor_cost: number | null
          notes: string | null
          organization_id: string
          parts_changed: string | null
          parts_cost: number | null
          photo_after_url: string | null
          photo_before_url: string | null
          repair_date: string
          repair_number: string
          repair_type: string
          status: string
          submitted_by: string | null
          total_cost: number | null
          updated_at: string
          warranty_days: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bus_id?: string | null
          bus_registration: string
          created_at?: string
          description: string
          id?: string
          labor_cost?: number | null
          notes?: string | null
          organization_id: string
          parts_changed?: string | null
          parts_cost?: number | null
          photo_after_url?: string | null
          photo_before_url?: string | null
          repair_date?: string
          repair_number: string
          repair_type: string
          status?: string
          submitted_by?: string | null
          total_cost?: number | null
          updated_at?: string
          warranty_days?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bus_id?: string | null
          bus_registration?: string
          created_at?: string
          description?: string
          id?: string
          labor_cost?: number | null
          notes?: string | null
          organization_id?: string
          parts_changed?: string | null
          parts_cost?: number | null
          photo_after_url?: string | null
          photo_before_url?: string | null
          repair_date?: string
          repair_number?: string
          repair_type?: string
          status?: string
          submitted_by?: string | null
          total_cost?: number | null
          updated_at?: string
          warranty_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_records_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "repair_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          distance_km: number | null
          estimated_duration_hours: number | null
          from_address: string | null
          from_state_id: string
          id: string
          route_name: string
          to_address: string | null
          to_state_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          distance_km?: number | null
          estimated_duration_hours?: number | null
          from_address?: string | null
          from_state_id: string
          id?: string
          route_name: string
          to_address?: string | null
          to_state_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          distance_km?: number | null
          estimated_duration_hours?: number | null
          from_address?: string | null
          from_state_id?: string
          id?: string
          route_name?: string
          to_address?: string | null
          to_state_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_from_state_id_fkey"
            columns: ["from_state_id"]
            isOneToOne: false
            referencedRelation: "indian_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_to_state_id_fkey"
            columns: ["to_state_id"]
            isOneToOne: false
            referencedRelation: "indian_states"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          created_at: string
          id: string
          item_name: string
          last_updated_by: string | null
          low_stock_threshold: number
          notes: string | null
          quantity: number
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          last_updated_by?: string | null
          low_stock_threshold?: number
          notes?: string | null
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          last_updated_by?: string | null
          low_stock_threshold?: number
          notes?: string | null
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          new_quantity: number
          notes: string | null
          previous_quantity: number
          quantity_change: number
          stock_item_id: string
          transaction_type: Database["public"]["Enums"]["stock_transaction_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          new_quantity: number
          notes?: string | null
          previous_quantity: number
          quantity_change: number
          stock_item_id: string
          transaction_type: Database["public"]["Enums"]["stock_transaction_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          new_quantity?: number
          notes?: string | null
          previous_quantity?: number
          quantity_change?: number
          stock_item_id?: string
          transaction_type?: Database["public"]["Enums"]["stock_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          bus_id: string | null
          bus_name_snapshot: string | null
          created_at: string
          distance_return: number | null
          distance_traveled: number | null
          driver_id: string | null
          driver_name_snapshot: string | null
          end_date: string | null
          gst_percentage: number | null
          id: string
          notes: string | null
          odometer_end: number | null
          odometer_return_end: number | null
          odometer_return_start: number | null
          odometer_start: number | null
          return_revenue_agent: number | null
          return_revenue_cash: number | null
          return_revenue_online: number | null
          return_revenue_others: number | null
          return_revenue_paytm: number | null
          return_total_expense: number | null
          return_total_revenue: number | null
          revenue_agent: number | null
          revenue_cash: number | null
          revenue_online: number | null
          revenue_others: number | null
          revenue_paytm: number | null
          route_id: string
          start_date: string
          status: Database["public"]["Enums"]["trip_status"]
          total_expense: number | null
          total_revenue: number | null
          trip_number: string
          trip_type: string
          updated_at: string
        }
        Insert: {
          bus_id?: string | null
          bus_name_snapshot?: string | null
          created_at?: string
          distance_return?: number | null
          distance_traveled?: number | null
          driver_id?: string | null
          driver_name_snapshot?: string | null
          end_date?: string | null
          gst_percentage?: number | null
          id?: string
          notes?: string | null
          odometer_end?: number | null
          odometer_return_end?: number | null
          odometer_return_start?: number | null
          odometer_start?: number | null
          return_revenue_agent?: number | null
          return_revenue_cash?: number | null
          return_revenue_online?: number | null
          return_revenue_others?: number | null
          return_revenue_paytm?: number | null
          return_total_expense?: number | null
          return_total_revenue?: number | null
          revenue_agent?: number | null
          revenue_cash?: number | null
          revenue_online?: number | null
          revenue_others?: number | null
          revenue_paytm?: number | null
          route_id: string
          start_date: string
          status?: Database["public"]["Enums"]["trip_status"]
          total_expense?: number | null
          total_revenue?: number | null
          trip_number: string
          trip_type?: string
          updated_at?: string
        }
        Update: {
          bus_id?: string | null
          bus_name_snapshot?: string | null
          created_at?: string
          distance_return?: number | null
          distance_traveled?: number | null
          driver_id?: string | null
          driver_name_snapshot?: string | null
          end_date?: string | null
          gst_percentage?: number | null
          id?: string
          notes?: string | null
          odometer_end?: number | null
          odometer_return_end?: number | null
          odometer_return_start?: number | null
          odometer_start?: number | null
          return_revenue_agent?: number | null
          return_revenue_cash?: number | null
          return_revenue_online?: number | null
          return_revenue_others?: number | null
          return_revenue_paytm?: number | null
          return_total_expense?: number | null
          return_total_revenue?: number | null
          revenue_agent?: number | null
          revenue_cash?: number | null
          revenue_online?: number | null
          revenue_others?: number | null
          revenue_paytm?: number | null
          route_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["trip_status"]
          total_expense?: number | null
          total_revenue?: number | null
          trip_number?: string
          trip_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_profile_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "driver" | "repair_org"
      bus_status: "active" | "maintenance" | "inactive"
      expense_status: "pending" | "approved" | "denied"
      ownership_type: "owned" | "partnership"
      stock_transaction_type: "add" | "remove" | "adjustment"
      tax_status: "pending" | "paid" | "overdue"
      trip_status: "scheduled" | "in_progress" | "completed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "driver", "repair_org"],
      bus_status: ["active", "maintenance", "inactive"],
      expense_status: ["pending", "approved", "denied"],
      ownership_type: ["owned", "partnership"],
      stock_transaction_type: ["add", "remove", "adjustment"],
      tax_status: ["pending", "paid", "overdue"],
      trip_status: ["scheduled", "in_progress", "completed", "cancelled"],
    },
  },
} as const
