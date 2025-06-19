export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'user' | 'admin'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: UserRole
          created_at: string
          plan_id: string | null
          credits_remaining: number
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: UserRole
          created_at?: string
          plan_id?: string | null
          credits_remaining?: number
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: UserRole
          created_at?: string
          plan_id?: string | null
          credits_remaining?: number
        }
      }
      documents: {
        Row: {
          id: string
          user_id: string | null
          name: string
          created_at: string
          drm_protected_pages: Json | null
          is_private: boolean
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          created_at?: string
          drm_protected_pages?: Json | null
          is_private?: boolean
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          created_at?: string
          drm_protected_pages?: Json | null
          is_private?: boolean
        }
      }
      document_regions: {
        Row: {
          id: string
          document_id: string
          user_id: string
          page: number
          x: number
          y: number
          width: number
          height: number
          type: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          user_id: string
          page: number
          x: number
          y: number
          width: number
          height: number
          type: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          user_id?: string
          page?: number
          x?: number
          y?: number
          width?: number
          height?: number
          type?: string
          name?: string
          description?: string | null
          created_at?: string
        }
      }
      text_assignments: {
        Row: {
          id: string
          user_id: string
          document_id: string
          region_id: string
          text_title: string
          text_content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          document_id: string
          region_id: string
          text_title: string
          text_content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          document_id?: string
          region_id?: string
          text_title?: string
          text_content?: string
          created_at?: string
          updated_at?: string
        }
      }
      credit_plans: {
        Row: {
          id: string
          name: string
          credits_included: number
          price: number
          duration_days: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          credits_included: number
          price?: number
          duration_days?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          credits_included?: number
          price?: number
          duration_days?: number | null
          created_at?: string
        }
      }
      tts_requests: {
        Row: {
          id: string
          user_id: string
          document_id: string
          requested_pages: number[]
          status: string
          cost_in_credits: number
          extra_cost_da: number | null
          created_at: string
          updated_at: string
          final_audio_path: string | null
          voice_type: string | null
        }
        Insert: {
          id?: string
          user_id: string
          document_id: string
          requested_pages: number[]
          status?: string
          cost_in_credits: number
          extra_cost_da?: number | null
          created_at?: string
          updated_at?: string
          final_audio_path?: string | null
          voice_type?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          document_id?: string
          requested_pages?: number[]
          status?: string
          cost_in_credits?: number
          extra_cost_da?: number | null
          created_at?: string
          updated_at?: string
          final_audio_path?: string | null
          voice_type?: string | null
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          message: string
          link: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message: string
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          message?: string
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
      }
      document_texts: {
        Row: {
          id: string
          user_id: string
          document_id: string
          title: string
          content: string
          created_at: string
          page: number
          assigned_region_id: string | null
          order_index: number
        }
        Insert: {
          id?: string
          user_id: string
          document_id: string
          title: string
          content: string
          created_at?: string
          page?: number
          assigned_region_id?: string | null
          order_index: number
        }
        Update: {
          id?: string
          user_id?: string
          document_id?: string
          title?: string
          content?: string
          created_at?: string
          page?: number
          assigned_region_id?: string | null
          order_index?: number
        }
      }
      admin_tasks: {
        Row: {
          id: string
          tts_request_id: string
          status: string
          assigned_to: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tts_request_id: string
          status?: string
          assigned_to?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tts_request_id?: string
          status?: string
          assigned_to?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      tts_audio_files: {
        Row: {
          id: string
          tts_request_id: string
          page_number: number
          storage_path: string
          file_size: number | null
          duration_seconds: number | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tts_request_id: string
          page_number: number
          storage_path: string
          file_size?: number | null
          duration_seconds?: number | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tts_request_id?: string
          page_number?: number
          storage_path?: string
          file_size?: number | null
          duration_seconds?: number | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}