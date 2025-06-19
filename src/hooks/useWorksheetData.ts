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

      // Use Supabase if configured
      const { data: document, error: documentError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', worksheetId)
        .single()

      if (documentError) {
        throw new Error(`Failed to fetch document: ${documentError.message}`)
      }

      const { data: regions, error: regionsError } = await supabase
        .from('document_regions')
        .select('*')
        .eq('document_id', worksheetId)
        .order('page', { ascending: true })

      if (regionsError) {
        throw new Error(`Failed to fetch regions: ${regionsError.message}`)
      }

      // Process regions to ensure description is properly formatted
      const processedRegions = (regions || []).map(region => ({
        ...region,
        description: region.description ? 
          (typeof region.description === 'string' ? 
            region.description.split('\n').filter(p => p.trim() !== '') : 
            region.description) : 
          []
      }))

      return {
        documentName: document.name,
        documentId: document.id,
        drmProtectedPages: document.drm_protected_pages || [],
        regions: processedRegions
      }
    },
    enabled: !!worksheetId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry if it's a 404 or if Supabase is not configured
      if (error.message.includes('404') || !shouldUseSupabase()) {
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

      // Use Supabase if configured
      const { data, error } = await supabase
        .from('document_regions')
        .select('*')
        .eq('document_id', worksheetId)
        .eq('page', pageNumber)
        .order('created_at', { ascending: true })

      if (error) {
        throw new Error(`Failed to fetch regions: ${error.message}`)
      }

      // Process regions to ensure description is properly formatted
      const processedRegions = (data || []).map(region => ({
        ...region,
        description: region.description ? 
          (typeof region.description === 'string' ? 
            region.description.split('\n').filter(p => p.trim() !== '') : 
            region.description) : 
          []
      }))

      return processedRegions
    },
    enabled: !!worksheetId && !!pageNumber,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}