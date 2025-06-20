import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate environment variables first
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
      })
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error: Missing required environment variables',
          details: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

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

    // Initialize Supabase client with validated environment variables
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch worksheet metadata
    const { data: worksheet, error: worksheetError } = await supabase
      .from('worksheets')
      .select('*')
      .eq('id', worksheetId)
      .single()

    if (worksheetError) {
      console.error('Worksheet fetch error:', worksheetError)
      return new Response(
        JSON.stringify({ error: 'Worksheet not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Fetch regions for this worksheet
    const { data: regions, error: regionsError } = await supabase
      .from('regions')
      .select('*')
      .eq('worksheet_id', worksheetId)
      .order('page', { ascending: true })

    if (regionsError) {
      console.error('Regions fetch error:', regionsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch regions' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get PDF URL from storage
    const { data: pdfData } = await supabase.storage
      .from('private-pdfs')
      .createSignedUrl(`${worksheetId}.pdf`, 3600) // 1 hour expiry

    const pdfUrl = pdfData?.signedUrl || `/pdfs/${worksheetId}.pdf`

    // Transform data to match expected format
    const responseData = {
      meta: {
        documentName: worksheet.document_name,
        documentId: worksheet.document_id,
        drmProtectedPages: worksheet.drm_protected_pages || [],
        drmProtected: worksheet.drm_protected || false,
        regions: regions?.map(region => ({
          id: region.id,
          document_id: worksheet.document_id,
          user_id: 'system', // Since this is public data
          page: region.page,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          type: region.type,
          name: region.name,
          description: region.description || [],
          created_at: region.created_at
        })) || []
      },
      pdfUrl
    }

    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})