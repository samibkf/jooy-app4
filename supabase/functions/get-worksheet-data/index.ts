import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { worksheetId } = await req.json()

    if (!worksheetId) {
      return new Response(
        JSON.stringify({ error: 'worksheetId is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Fetch worksheet metadata from database
    const { data: worksheet, error: worksheetError } = await supabase
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

    // Fetch regions for the worksheet
    const { data: regions, error: regionsError } = await supabase
      .from('regions')
      .select('*')
      .eq('worksheet_id', worksheetId)
      .order('page', { ascending: true })

    if (regionsError) {
      console.error('Error fetching regions:', regionsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch worksheet regions' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Prepare worksheet metadata
    const worksheetMeta = {
      documentName: worksheet.document_name,
      documentId: worksheet.document_id,
      drmProtectedPages: worksheet.drm_protected_pages || [],
      drmProtected: worksheet.drm_protected || false,
      regions: regions || []
    }

    // Generate PDF URL (fallback method)
    const pdfUrl = `${supabaseUrl}/storage/v1/object/public/pdfs/${worksheetId}.pdf`

    return new Response(
      JSON.stringify({
        meta: worksheetMeta,
        pdfUrl: pdfUrl
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in get-worksheet-data:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})