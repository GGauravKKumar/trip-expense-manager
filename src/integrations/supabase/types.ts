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
      buses: {
        Row: {
          bus_name: string | null
          bus_type: string | null
          capacity: number
          created_at: string
          fitness_expiry: string | null
          id: string
          insurance_expiry: string | null
          puc_expiry: string | null
          registration_number: string
          status: Database["public"]["Enums"]["bus_status"]
          updated_at: string
        }
        Insert: {
          bus_name?: string | null
          bus_type?: string | null
          capacity?: number
          created_at?: string
          fitness_expiry?: string | null
          id?: string
          insurance_expiry?: string | null
          puc_expiry?: string | null
          registration_number: string
          status?: Database["public"]["Enums"]["bus_status"]
          updated_at?: string
        }
        Update: {
          bus_name?: string | null
          bus_type?: string | null
          capacity?: number
          created_at?: string
          fitness_expiry?: string | null
          id?: string
          insurance_expiry?: string | null
          puc_expiry?: string | null
          registration_number?: string
          status?: Database["public"]["Enums"]["bus_status"]
          updated_at?: string
        }
        Relationships: []
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
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      trips: {
        Row: {
          bus_id: string
          created_at: string
          driver_id: string
          end_date: string | null
          id: string
          notes: string | null
          route_id: string
          start_date: string
          status: Database["public"]["Enums"]["trip_status"]
          total_expense: number | null
          trip_number: string
          updated_at: string
        }
        Insert: {
          bus_id: string
          created_at?: string
          driver_id: string
          end_date?: string | null
          id?: string
          notes?: string | null
          route_id: string
          start_date: string
          status?: Database["public"]["Enums"]["trip_status"]
          total_expense?: number | null
          trip_number: string
          updated_at?: string
        }
        Update: {
          bus_id?: string
          created_at?: string
          driver_id?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          route_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["trip_status"]
          total_expense?: number | null
          trip_number?: string
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
      app_role: "admin" | "driver"
      bus_status: "active" | "maintenance" | "inactive"
      expense_status: "pending" | "approved" | "denied"
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
      app_role: ["admin", "driver"],
      bus_status: ["active", "maintenance", "inactive"],
      expense_status: ["pending", "approved", "denied"],
      trip_status: ["scheduled", "in_progress", "completed", "cancelled"],
    },
  },
} as const
