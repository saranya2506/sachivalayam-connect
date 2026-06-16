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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_registrations: {
        Row: {
          archived: boolean
          archived_at: string | null
          archived_by: string | null
          created_at: string
          department: string
          district: string
          employee_id: string
          id: string
          mandal: string
          user_id: string
          verification_date: string | null
          verification_remarks: string | null
          verification_status: Database["public"]["Enums"]["admin_verification_status"]
          verified_by: string | null
          village_ward: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          department: string
          district: string
          employee_id: string
          id?: string
          mandal: string
          user_id: string
          verification_date?: string | null
          verification_remarks?: string | null
          verification_status?: Database["public"]["Enums"]["admin_verification_status"]
          verified_by?: string | null
          village_ward: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          department?: string
          district?: string
          employee_id?: string
          id?: string
          mandal?: string
          user_id?: string
          verification_date?: string | null
          verification_remarks?: string | null
          verification_status?: Database["public"]["Enums"]["admin_verification_status"]
          verified_by?: string | null
          village_ward?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_archived: boolean
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_archived?: boolean
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_archived?: boolean
          metadata?: Json | null
        }
        Relationships: []
      }
      complaint_timeline: {
        Row: {
          complaint_id: string
          created_at: string
          id: string
          remarks: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          updated_by: string | null
        }
        Insert: {
          complaint_id: string
          created_at?: string
          id?: string
          remarks?: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          updated_by?: string | null
        }
        Update: {
          complaint_id?: string
          created_at?: string
          id?: string
          remarks?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_timeline_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          assigned_admin_id: string | null
          assigned_at: string | null
          assigned_officer_id: string | null
          assignment_remarks: string | null
          category: Database["public"]["Enums"]["complaint_category"]
          citizen_id: string
          complaint_number: string
          created_at: string
          department: string | null
          description: string
          id: string
          last_remark: string | null
          location: string
          photo_url: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_admin_id?: string | null
          assigned_at?: string | null
          assigned_officer_id?: string | null
          assignment_remarks?: string | null
          category: Database["public"]["Enums"]["complaint_category"]
          citizen_id: string
          complaint_number: string
          created_at?: string
          department?: string | null
          description: string
          id?: string
          last_remark?: string | null
          location: string
          photo_url?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_admin_id?: string | null
          assigned_at?: string | null
          assigned_officer_id?: string | null
          assignment_remarks?: string | null
          category?: Database["public"]["Enums"]["complaint_category"]
          citizen_id?: string
          complaint_number?: string
          created_at?: string
          department?: string | null
          description?: string
          id?: string
          last_remark?: string | null
          location?: string
          photo_url?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      officers: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          department: string
          id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          department: string
          id?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          department?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_status: boolean
          address: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          last_login: string | null
          mobile_number: string | null
          updated_at: string
          village: string | null
        }
        Insert: {
          active_status?: boolean
          address?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id: string
          last_login?: string | null
          mobile_number?: string | null
          updated_at?: string
          village?: string | null
        }
        Update: {
          active_status?: boolean
          address?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          last_login?: string | null
          mobile_number?: string | null
          updated_at?: string
          village?: string | null
        }
        Relationships: []
      }
      service_app_documents: {
        Row: {
          application_id: string
          created_at: string
          doc_type: string
          file_path: string | null
          id: string
          notes: string | null
          requested_by: string | null
          status: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          doc_type: string
          file_path?: string | null
          id?: string
          notes?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          doc_type?: string
          file_path?: string | null
          id?: string
          notes?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_app_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "service_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      service_app_timeline: {
        Row: {
          application_id: string
          created_at: string
          id: string
          remarks: string | null
          status: Database["public"]["Enums"]["service_app_status"]
          updated_by: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          remarks?: string | null
          status: Database["public"]["Enums"]["service_app_status"]
          updated_by?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          remarks?: string | null
          status?: Database["public"]["Enums"]["service_app_status"]
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_app_timeline_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "service_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      service_applications: {
        Row: {
          aadhaar_number: string
          address: string
          application_number: string | null
          application_type: Database["public"]["Enums"]["service_app_type"]
          approved_at: string | null
          assigned_admin_id: string | null
          assigned_at: string | null
          assigned_officer_id: string | null
          assignment_remarks: string | null
          citizen_id: string
          citizen_name: string
          completed_at: string | null
          created_at: string
          department: string | null
          district: string
          email: string | null
          id: string
          last_remark: string | null
          mandal: string
          mobile_number: string
          status: Database["public"]["Enums"]["service_app_status"]
          updated_at: string
          village: string
        }
        Insert: {
          aadhaar_number: string
          address: string
          application_number?: string | null
          application_type: Database["public"]["Enums"]["service_app_type"]
          approved_at?: string | null
          assigned_admin_id?: string | null
          assigned_at?: string | null
          assigned_officer_id?: string | null
          assignment_remarks?: string | null
          citizen_id: string
          citizen_name: string
          completed_at?: string | null
          created_at?: string
          department?: string | null
          district: string
          email?: string | null
          id?: string
          last_remark?: string | null
          mandal: string
          mobile_number: string
          status?: Database["public"]["Enums"]["service_app_status"]
          updated_at?: string
          village: string
        }
        Update: {
          aadhaar_number?: string
          address?: string
          application_number?: string | null
          application_type?: Database["public"]["Enums"]["service_app_type"]
          approved_at?: string | null
          assigned_admin_id?: string | null
          assigned_at?: string | null
          assigned_officer_id?: string | null
          assignment_remarks?: string | null
          citizen_id?: string
          citizen_name?: string
          completed_at?: string | null
          created_at?: string
          department?: string | null
          district?: string
          email?: string | null
          id?: string
          last_remark?: string | null
          mandal?: string
          mobile_number?: string
          status?: Database["public"]["Enums"]["service_app_status"]
          updated_at?: string
          village?: string
        }
        Relationships: []
      }
      system_state: {
        Row: {
          bootstrap_completed: boolean
          id: number
        }
        Insert: {
          bootstrap_completed?: boolean
          id?: number
        }
        Update: {
          bootstrap_completed?: boolean
          id?: number
        }
        Relationships: []
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
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      admin_verification_status: "pending" | "approved" | "rejected"
      app_role: "government_authority" | "admin" | "officer" | "citizen"
      complaint_category:
        | "water_supply"
        | "drainage"
        | "roads"
        | "street_lights"
        | "sanitation"
        | "certificates"
        | "pensions"
        | "others"
      complaint_status:
        | "submitted"
        | "assigned"
        | "under_review"
        | "in_progress"
        | "resolved"
        | "rejected"
      service_app_status:
        | "submitted"
        | "assigned"
        | "under_verification"
        | "documents_required"
        | "approved"
        | "rejected"
        | "completed"
      service_app_type:
        | "income_certificate"
        | "pension"
        | "ration_card"
        | "caste_certificate"
        | "residence_certificate"
        | "birth_certificate"
        | "death_certificate"
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
      admin_verification_status: ["pending", "approved", "rejected"],
      app_role: ["government_authority", "admin", "officer", "citizen"],
      complaint_category: [
        "water_supply",
        "drainage",
        "roads",
        "street_lights",
        "sanitation",
        "certificates",
        "pensions",
        "others",
      ],
      complaint_status: [
        "submitted",
        "assigned",
        "under_review",
        "in_progress",
        "resolved",
        "rejected",
      ],
      service_app_status: [
        "submitted",
        "assigned",
        "under_verification",
        "documents_required",
        "approved",
        "rejected",
        "completed",
      ],
      service_app_type: [
        "income_certificate",
        "pension",
        "ration_card",
        "caste_certificate",
        "residence_certificate",
        "birth_certificate",
        "death_certificate",
      ],
    },
  },
} as const
