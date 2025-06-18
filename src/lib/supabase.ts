import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

export const shouldUseSupabase = () => {
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'your-supabase-url' && supabaseAnonKey !== 'your-supabase-anon-key')
}

export const isMissingTableError = (error: any): boolean => {
  if (!error) return false
  
  // Check for various formats of missing table errors
  const errorMessage = error.message || error.details || ''
  const errorCode = error.code || ''
  
  // PostgreSQL error code for relation does not exist
  if (errorCode === '42P01') return true
  
  // Check for HTTP response errors that contain the PostgreSQL error
  if (error.status === 404 && error.body) {
    try {
      const bodyObj = typeof error.body === 'string' ? JSON.parse(error.body) : error.body
      if (bodyObj.code === '42P01') return true
    } catch (e) {
      // If parsing fails, continue with string checks
    }
  }
  
  // Check error message patterns
  const missingTablePatterns = [
    'relation "public.worksheets" does not exist',
    'relation "public.regions" does not exist',
    'relation "worksheets" does not exist',
    'relation "regions" does not exist',
    'table "worksheets" does not exist',
    'table "regions" does not exist',
    'does not exist',
    'PGRST116' // PostgREST error for missing table
  ]
  
  return missingTablePatterns.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  )
}