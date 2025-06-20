import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Accept-Ranges': 'bytes', // Tell the browser we support range requests
}

serve(async (req) => {
  // Handle CORS preflight request
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

    const url = new URL(req.url)
    const worksheetId = url.searchParams.get('id')

    if (!worksheetId) {
      throw new Error('worksheetId is a required query parameter.')
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)
    
    // --- CORRECTED LOGIC FOR FLAT FILE STRUCTURE ---
    const filePath = `${worksheetId}.pdf`

    // Step A: Get file metadata (especially size) from the root of the bucket.
    const { data: fileMetadata, error: metadataError } = await supabaseAdmin.storage
      .from('pdfs')
      .list('', { search: filePath, limit: 1 })
      
    if (metadataError || !fileMetadata || fileMetadata.length === 0) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileSize = fileMetadata[0].metadata.size
    
    // Step B: Parse the Range header from the request.
    const range = req.headers.get('range')
    let start = 0
    let end = fileSize - 1

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      start = parseInt(parts[0], 10)
      end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    }

    const chunkSize = end - start + 1
    
    // Step C: Fetch only the requested chunk from storage.
    const { data: chunk, error: chunkError } = await supabaseAdmin.storage
      .from('pdfs')
      .download(filePath, { offset: start, limit: chunkSize })
      
    if (chunkError) throw chunkError

    // Step D: Construct the 206 Partial Content response.
    const headers = new Headers({
      ...corsHeaders,
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': `${chunkSize}`,
      'Content-Type': 'application/pdf',
    })

    return new Response(await chunk.arrayBuffer(), { status: 206, headers })

  } catch (err) {
    console.error('Stream PDF error:', err)
    return new Response(JSON.stringify({ 
      error: err.message,
      details: 'Failed to stream PDF file'
    }), {
      status: 404, // Use 404 for "Not Found" errors
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})