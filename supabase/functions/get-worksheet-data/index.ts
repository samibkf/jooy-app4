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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch document metadata
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', worksheetId)
      .single()

    if (documentError) {
      console.error('Document fetch error:', documentError)
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Fetch regions for this document
    const { data: regions, error: regionsError } = await supabase
      .from('document_regions')
      .select('*')
      .eq('document_id', worksheetId)
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

    // Process regions to ensure description is properly formatted
    const processedRegions = (regions || []).map(region => {
      let processedDescription: string[] = [];
      
      if (region.description) {
        if (typeof region.description === 'string') {
          // Split by newlines and filter out empty paragraphs
          processedDescription = region.description
            .split('\n')
            .filter(paragraph => paragraph.trim() !== '');
        }
      }
      
      return {
        id: region.id,
        document_id: region.document_id,
        user_id: region.user_id,
        page: region.page,
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        type: region.type,
        name: region.name,
        description: processedDescription,
        created_at: region.created_at
      };
    });

    // Transform data to match expected format
    const responseData = {
      meta: {
        documentName: document.name,
        documentId: document.id,
        drmProtectedPages: document.drm_protected_pages || [],
        regions: processedRegions
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
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})