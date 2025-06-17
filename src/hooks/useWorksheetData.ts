import { useQuery } from '@tanstack/react-query'
import { supabase, shouldUseSupabase } from '@/lib/supabase'
import type { WorksheetMetadata } from '@/types/worksheet'

export const useWorksheetData = (worksheetId: string) => {
  return useQuery({
    queryKey: ['worksheet', worksheetId],
    queryFn: async (): Promise<WorksheetMetadata> => {
      // If Supabase is not configured, fallback to JSON files
      if (!shouldUseSupabase()) {
        console.log('Supabase not configured, using JSON fallback')
        const response = await fetch(`/data/${worksheetId}.json`)
        if (!response.ok) {
          throw new Error(`Failed to fetch worksheet data: ${response.status}`)
        }
        return response.json()
      }

      try {
        // Use Supabase if configured
        const { data: worksheet, error: worksheetError } = await supabase
          .from('worksheets')
          .select('*')
          .eq('id', worksheetId)
          .single()

        if (worksheetError) {
          // If table doesn't exist, fall back to JSON
          if (worksheetError.code === '42P01') {
            console.log('Supabase tables not found, falling back to JSON')
            const response = await fetch(`/data/${worksheetId}.json`)
            if (!response.ok) {
              throw new Error(`Failed to fetch worksheet data: ${response.status}`)
            }
            return response.json()
          }
          throw new Error(`Failed to fetch worksheet: ${worksheetError.message}`)
        }

        const { data: regions, error: regionsError } = await supabase
          .from('regions')
          .select('*')
          .eq('worksheet_id', worksheetId)
          .order('page', { ascending: true })

        if (regionsError) {
          // If table doesn't exist, fall back to JSON
          if (regionsError.code === '42P01') {
            console.log('Supabase tables not found, falling back to JSON')
            const response = await fetch(`/data/${worksheetId}.json`)
            if (!response.ok) {
              throw new Error(`Failed to fetch worksheet data: ${response.status}`)
            }
            return response.json()
          }
          throw new Error(`Failed to fetch regions: ${regionsError.message}`)
        }

        return {
          documentName: worksheet.document_name,
          documentId: worksheet.document_id,
          drmProtectedPages: worksheet.drm_protected_pages || [],
          drmProtected: worksheet.drm_protected || false,
          regions: regions || []
        }
      } catch (error: any) {
        // If any Supabase error occurs, fall back to JSON
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          console.log('Supabase tables not found, falling back to JSON')
          const response = await fetch(`/data/${worksheetId}.json`)
          if (!response.ok) {
            throw new Error(`Failed to fetch worksheet data: ${response.status}`)
          }
          return response.json()
        }
        throw error
      }
    },
    enabled: !!worksheetId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry if it's a 404 or if Supabase is not configured
      if (error.message.includes('404') || !shouldUseSupabase()) {
        return false
      }
      // Don't retry if tables don't exist - we'll fall back to JSON
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        return false
      }
      return failureCount < 3
    }
  })
}

export const useRegionsByPage = (worksheetId: string, pageNumber: number) => {
  return useQuery({
    queryKey: ['regions', worksheetId, pageNumber],
    queryFn: async () => {
      // If Supabase is not configured, fallback to JSON files
      if (!shouldUseSupabase()) {
        const response = await fetch(`/data/${worksheetId}.json`)
        if (!response.ok) {
          throw new Error(`Failed to fetch worksheet data: ${response.status}`)
        }
        const data = await response.json()
        return data.regions?.filter((region: any) => region.page === pageNumber) || []
      }

      try {
        // Use Supabase if configured
        const { data, error } = await supabase
          .from('regions')
          .select('*')
          .eq('worksheet_id', worksheetId)
          .eq('page', pageNumber)
          .order('created_at', { ascending: true })

        if (error) {
          // If table doesn't exist, fall back to JSON
          if (error.code === '42P01') {
            console.log('Supabase tables not found, falling back to JSON')
            const response = await fetch(`/data/${worksheetId}.json`)
            if (!response.ok) {
              throw new Error(`Failed to fetch worksheet data: ${response.status}`)
            }
            const data = await response.json()
            return data.regions?.filter((region: any) => region.page === pageNumber) || []
          }
          throw new Error(`Failed to fetch regions: ${error.message}`)
        }

        return data || []
      } catch (error: any) {
        // If any Supabase error occurs, fall back to JSON
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          console.log('Supabase tables not found, falling back to JSON')
          const response = await fetch(`/data/${worksheetId}.json`)
          if (!response.ok) {
            throw new Error(`Failed to fetch worksheet data: ${response.status}`)
          }
          const data = await response.json()
          return data.regions?.filter((region: any) => region.page === pageNumber) || []
        }
        throw error
      }
    },
    enabled: !!worksheetId && !!pageNumber,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}