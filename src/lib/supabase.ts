import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Create a mock client for development when Supabase is not configured
const createMockClient = () => ({
  from: () => ({
    select: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
    insert: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
    update: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
    delete: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
    eq: function() { return this },
    single: function() { return this },
    order: function() { return this }
  }),
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    signIn: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
    signOut: () => Promise.resolve({ error: null }),
  },
})

// Check if environment variables are properly configured
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== 'your_supabase_url_here' && 
  supabaseAnonKey !== 'your_supabase_anon_key_here'

export const supabase = isSupabaseConfigured 
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : createMockClient() as any

export const isSupabaseReady = isSupabaseConfigured

// Helper function to check if we should use Supabase or fallback to JSON
// Now also checks for table existence errors
export const shouldUseSupabase = () => isSupabaseConfigured

// Helper function to check if error indicates missing tables
export const isMissingTableError = (error: any): boolean => {
  if (!error) return false
  
  // Check for various indicators of missing table
  const errorMessage = error.message || ''
  const errorCode = error.code || ''
  
  return (
    errorCode === '42P01' || // PostgreSQL relation does not exist
    errorMessage.includes('relation') && errorMessage.includes('does not exist') ||
    errorMessage.includes('table') && errorMessage.includes('does not exist') ||
    errorMessage.includes('worksheets') && errorMessage.includes('does not exist')
  )
}

export type { Database }