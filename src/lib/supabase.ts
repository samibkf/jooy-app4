import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Database {
  public: {
    Tables: {
      worksheets: {
        Row: {
          id: string
          document_name: string
          document_id: string
          drm_protected: boolean
          drm_protected_pages: number[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          document_name: string
          document_id?: string
          drm_protected?: boolean
          drm_protected_pages?: number[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          document_name?: string
          document_id?: string
          drm_protected?: boolean
          drm_protected_pages?: number[]
          created_at?: string
          updated_at?: string
        }
      }
      regions: {
        Row: {
          id: string
          worksheet_id: string
          page: number
          x: number
          y: number
          width: number
          height: number
          type: string
          name: string
          description: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          worksheet_id: string
          page: number
          x: number
          y: number
          width: number
          height: number
          type?: string
          name: string
          description?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          worksheet_id?: string
          page?: number
          x?: number
          y?: number
          width?: number
          height?: number
          type?: string
          name?: string
          description?: string[]
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}