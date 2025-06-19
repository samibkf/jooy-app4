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

    // Get the authorization header to identify the user
    const authHeader = req.headers.get('authorization')
    let userId = null
    
    if (authHeader) {
      try {
        // Extract the JWT token and verify it
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        
        if (!authError && user) {
          userId = user.id
        }
      } catch (authError) {
        console.warn('Auth verification failed:', authError)
      }
    }

    // Fetch worksheet metadata from documents table
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', worksheetId)
      .single()

    if (documentError) {
      console.error('Document fetch error:', documentError)
      return new Response(
        JSON.stringify({ error: 'Worksheet not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user has access to this document
    // For now, we'll allow access if the document exists and is not private
    // or if the user is the owner
    const hasAccess = !document.is_private || (userId && document.user_id === userId)
    
    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this worksheet' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Fetch regions for this worksheet
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

    // Get PDF URL from storage - only return if it exists and user has access
    let pdfUrl = null
    
    try {
      const { data: pdfData, error: pdfError } = await supabase.storage
        .from('private-pdfs')
        .createSignedUrl(`${worksheetId}.pdf`, 3600) // 1 hour expiry

      if (!pdfError && pdfData?.signedUrl) {
        pdfUrl = pdfData.signedUrl
      } else {
        console.warn('PDF not found in storage or access denied:', pdfError)
      }
    } catch (pdfError) {
      console.warn('Error accessing PDF storage:', pdfError)
    }

    // If no PDF URL available, return error
    if (!pdfUrl) {
      return new Response(
        JSON.stringify({ error: 'PDF not found or access denied' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Transform data to match expected format
    const responseData = {
      meta: {
        documentName: document.name,
        documentId: document.id,
        drmProtectedPages: document.drm_protected_pages || [],
        drmProtected: document.is_private || false,
        regions: regions?.map(region => ({
          id: region.id,
          document_id: document.id,
          user_id: region.user_id,
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
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})