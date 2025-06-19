import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges'
}

interface StreamRequest {
  worksheetId: string
  range?: string
}

interface ErrorResponse {
  error: string
  details?: string
}

function createErrorResponse(message: string, status: number, details?: string): Response {
  const errorBody: ErrorResponse = { error: message }
  if (details) {
    errorBody.details = details
  }
  
  return new Response(
    JSON.stringify(errorBody),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

function parseRangeHeader(rangeHeader: string, fileSize: number): { start: number; end: number } | null {
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) return null;

  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize || start > end) {
    return null;
  }

  return { start, end };
}

async function validateRequest(req: Request): Promise<StreamRequest> {
  if (req.method === 'OPTIONS') {
    throw new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw createErrorResponse('Method not allowed', 405)
  }

  const url = new URL(req.url)
  const worksheetId = url.searchParams.get('id')

  if (!worksheetId || typeof worksheetId !== 'string') {
    throw createErrorResponse('Worksheet ID is required', 400)
  }

  if (!/^[A-Za-z0-9_-]+$/.test(worksheetId)) {
    throw createErrorResponse('Invalid worksheet ID format', 400)
  }

  const range = req.headers.get('range')

  return { worksheetId, range: range || undefined }
}

async function initializeSupabase() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseKey) {
    throw createErrorResponse('Supabase configuration missing', 500, 'Server configuration error')
  }

  return createClient(supabaseUrl, supabaseKey)
}

async function checkWorksheetExists(supabase: any, worksheetId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('worksheets')
      .select('id')
      .eq('id', worksheetId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Database error checking worksheet:', error)
      return false
    }

    return !!data
  } catch (error) {
    console.error('Error checking worksheet existence:', error)
    return false
  }
}

async function streamPdfFromStorage(supabase: any, worksheetId: string, range?: string): Promise<Response> {
  try {
    console.log(`Attempting to stream PDF from storage: ${worksheetId}.pdf`)

    // Get file info first
    const { data: fileList, error: listError } = await supabase.storage
      .from('private-pdfs')
      .list('', {
        search: `${worksheetId}.pdf`
      })

    if (listError || !fileList || fileList.length === 0) {
      console.log(`PDF not found in storage: ${worksheetId}.pdf`)
      throw new Error('PDF not found in storage')
    }

    const fileInfo = fileList[0]
    const fileSize = fileInfo.metadata?.size || 0

    console.log(`Found PDF in storage, size: ${fileSize} bytes`)

    // Handle range requests for partial content
    if (range && fileSize > 0) {
      const rangeInfo = parseRangeHeader(range, fileSize)
      
      if (!rangeInfo) {
        return new Response('Invalid range', { 
          status: 416,
          headers: {
            ...corsHeaders,
            'Content-Range': `bytes */${fileSize}`
          }
        })
      }

      const { start, end } = rangeInfo
      const contentLength = end - start + 1

      // Download the specific range
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from('private-pdfs')
        .download(`${worksheetId}.pdf`, {
          transform: {
            width: undefined,
            height: undefined,
            resize: undefined,
            format: undefined,
            quality: undefined
          }
        })

      if (downloadError || !pdfData) {
        console.error('Error downloading PDF from storage:', downloadError)
        throw new Error('Failed to download PDF from storage')
      }

      // Convert blob to array buffer and slice the range
      const arrayBuffer = await pdfData.arrayBuffer()
      const rangeBuffer = arrayBuffer.slice(start, end + 1)

      return new Response(rangeBuffer, {
        status: 206,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Length': contentLength.toString(),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
          'ETag': `"${worksheetId}-${fileSize}"`
        }
      })
    }

    // Full file download
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('private-pdfs')
      .download(`${worksheetId}.pdf`)

    if (downloadError || !pdfData) {
      console.error('Error downloading PDF from storage:', downloadError)
      throw new Error('Failed to download PDF from storage')
    }

    console.log(`Successfully downloaded PDF from storage: ${worksheetId}.pdf`)

    return new Response(pdfData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Length': fileSize.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'ETag': `"${worksheetId}-${fileSize}"`
      }
    })

  } catch (error) {
    console.log(`Storage streaming failed: ${error.message}`)
    throw error
  }
}

async function streamPdfFromPublic(worksheetId: string, range?: string): Promise<Response> {
  try {
    console.log(`Attempting to stream PDF from public URL: /pdfs/${worksheetId}.pdf`)

    // For public URLs, we'll create a redirect response
    // The actual streaming will be handled by the static file server
    const publicUrl = `/pdfs/${worksheetId}.pdf`

    // If range is requested, we can't handle it here for public files
    // The static file server should handle range requests
    if (range) {
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': publicUrl,
          'Cache-Control': 'public, max-age=3600'
        }
      })
    }

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': publicUrl,
        'Cache-Control': 'public, max-age=3600'
      }
    })

  } catch (error) {
    console.error(`Public URL streaming failed: ${error.message}`)
    throw error
  }
}

serve(async (req: Request) => {
  console.log(`${req.method} ${req.url}`)

  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    // Validate request
    const { worksheetId, range } = await validateRequest(req)

    // Initialize Supabase
    const supabase = await initializeSupabase()

    // Check if worksheet exists
    const worksheetExists = await checkWorksheetExists(supabase, worksheetId)
    if (!worksheetExists) {
      return createErrorResponse('Worksheet not found', 404, `No worksheet found with ID: ${worksheetId}`)
    }

    // Try to stream from storage first, then fallback to public
    try {
      return await streamPdfFromStorage(supabase, worksheetId, range)
    } catch (storageError) {
      console.log(`Storage streaming failed, falling back to public URL: ${storageError.message}`)
      
      try {
        return await streamPdfFromPublic(worksheetId, range)
      } catch (publicError) {
        console.error(`Both storage and public streaming failed: ${publicError.message}`)
        return createErrorResponse('PDF not found', 404, 'PDF file is not available')
      }
    }

  } catch (error) {
    // If error is already a Response (from our validation/error functions), return it
    if (error instanceof Response) {
      return error
    }

    // Handle unexpected errors
    console.error('Unexpected error in stream-pdf:', error)
    
    return createErrorResponse(
      'Internal server error', 
      500, 
      error instanceof Error ? error.message : 'Unknown error occurred'
    )
  }
})