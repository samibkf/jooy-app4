import { useQuery } from '@tanstack/react-query'
import { supabase, shouldUseSupabase, isMissingTableError } from '@/lib/supabase'
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
          // Check if this is a missing table error and fallback to JSON
          if (isMissingTableError(worksheetError)) {
            console.log('Supabase tables not found, falling back to JSON files. Please run: supabase db push')
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
          // Check if this is a missing table error and fallback to JSON
          if (isMissingTableError(regionsError)) {
            console.log('Supabase tables not found, falling back to JSON files. Please run: supabase db push')
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
        // Final fallback to JSON if any unexpected error occurs
        if (isMissingTableError(error) || error.message?.includes('42P01')) {
          console.log('Supabase tables not found, falling back to JSON files. Please run: supabase db push')
          try {
            const response = await fetch(`/data/${worksheetId}.json`)
            if (!response.ok) {
              throw new Error(`Failed to fetch worksheet data: ${response.status}`)
            }
            return response.json()
          } catch (jsonError) {
            throw new Error(`Both Supabase and JSON fallback failed. Supabase error: ${error.message}. JSON error: ${jsonError.message}`)
          }
        }
        throw error
      }
    },
    enabled: !!worksheetId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry if it's a 404, missing table error, or if Supabase is not configured
      if (error.message.includes('404') || isMissingTableError(error) || error.message?.includes('42P01') || !shouldUseSupabase()) {
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
          // Check if this is a missing table error and fallback to JSON
          if (isMissingTableError(error) || error.code === '42P01') {
            console.log('Supabase tables not found, falling back to JSON files. Please run: supabase db push')
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
        // Final fallback to JSON if any unexpected error occurs
        if (isMissingTableError(error) || error.message?.includes('42P01') || error.code === '42P01') {
          console.log('Supabase tables not found, falling back to JSON files. Please run: supabase db push')
          try {
            const response = await fetch(`/data/${worksheetId}.json`)
            if (!response.ok) {
              throw new Error(`Failed to fetch worksheet data: ${response.status}`)
            }
            const data = await response.json()
            return data.regions?.filter((region: any) => region.page === pageNumber) || []
          } catch (jsonError) {
            throw new Error(`Both Supabase and JSON fallback failed. Supabase error: ${error.message}. JSON error: ${jsonError.message}`)
          }
        }
        throw error
      }
    },
    enabled: !!worksheetId && !!pageNumber,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}