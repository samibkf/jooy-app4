import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { worksheetId } = await req.json()
    
    if (!worksheetId) {
      return new Response(
        JSON.stringify({ error: 'Worksheet ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch worksheet metadata
    const { data: worksheet, error: worksheetError } = await supabaseClient
      .from('worksheets')
      .select('*')
      .eq('id', worksheetId)
      .single()

    if (worksheetError) {
      console.error('Error fetching worksheet:', worksheetError)
      return new Response(
        JSON.stringify({ error: 'Worksheet not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Fetch regions for this worksheet
    const { data: regions, error: regionsError } = await supabaseClient
      .from('regions')
      .select('*')
      .eq('worksheet_id', worksheetId)
      .order('page', { ascending: true })

    if (regionsError) {
      console.error('Error fetching regions:', regionsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch regions' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get PDF URL from storage
    const { data: pdfData } = supabaseClient.storage
      .from('private-pdfs')
      .getPublicUrl(`${worksheetId}.pdf`)

    const response = {
      meta: {
        documentName: worksheet.document_name,
        documentId: worksheet.document_id,
        drmProtectedPages: worksheet.drm_protected_pages || [],
        drmProtected: worksheet.drm_protected || false,
        regions: regions || []
      },
      pdfUrl: pdfData.publicUrl
    }

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in get-worksheet-data function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})