import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Worksheet = Database['public']['Tables']['worksheets']['Row']
type Region = Database['public']['Tables']['regions']['Row']

export interface WorksheetWithRegions extends Worksheet {
  regions: Region[]
}

export const useWorksheetData = (worksheetId: string) => {
  return useQuery({
    queryKey: ['worksheet', worksheetId],
    queryFn: async (): Promise<WorksheetWithRegions | null> => {
      // First get the worksheet
      const { data: worksheet, error: worksheetError } = await supabase
        .from('worksheets')
        .select('*')
        .eq('id', worksheetId)
        .single()

      if (worksheetError) {
        if (worksheetError.code === 'PGRST116') {
          // No rows returned - worksheet not found
          return null
        }
        throw worksheetError
      }

      // Then get the regions for this worksheet
      const { data: regions, error: regionsError } = await supabase
        .from('regions')
        .select('*')
        .eq('worksheet_id', worksheetId)
        .order('page', { ascending: true })
        .order('name', { ascending: true })

      if (regionsError) {
        throw regionsError
      }

      return {
        ...worksheet,
        regions: regions || []
      }
    },
    enabled: !!worksheetId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry if worksheet not found
      if (error?.code === 'PGRST116') {
        return false
      }
      return failureCount < 3
    }
  })
}

export const useRegionsByPage = (worksheetId: string, page: number) => {
  return useQuery({
    queryKey: ['regions', worksheetId, page],
    queryFn: async (): Promise<Region[]> => {
      const { data, error } = await supabase
        .from('regions')
        .select('*')
        .eq('worksheet_id', worksheetId)
        .eq('page', page)
        .order('name', { ascending: true })

      if (error) {
        throw error
      }

      return data || []
    },
    enabled: !!worksheetId && !!page,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}