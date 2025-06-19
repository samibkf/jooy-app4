import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

interface WorksheetRequest {
  worksheetId: string
}

interface WorksheetResponse {
  meta: {
    documentName: string
    documentId: string
    drmProtectedPages: number[]
    drmProtected: boolean
    regions: Array<{
      id: string
      document_id: string
      user_id: string
      page: number
      x: number
      y: number
      width: number
      height: number
      type: string
      name: string
      description: string[]
      created_at: string
    }>
  }
  pdfUrl: string
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
      headers: corsHeaders
    }
  )
}

function createSuccessResponse(data: WorksheetResponse): Response {
  return new Response(
    JSON.stringify(data),
    { 
      status: 200,
      headers: corsHeaders
    }
  )
}

async function validateRequest(req: Request): Promise<WorksheetRequest> {
  if (req.method === 'OPTIONS') {
    throw new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    throw createErrorResponse('Method not allowed', 405)
  }

  let body: any
  try {
    body = await req.json()
  } catch (error) {
    throw createErrorResponse('Invalid JSON in request body', 400)
  }

  const { worksheetId } = body

  if (!worksheetId || typeof worksheetId !== 'string') {
    throw createErrorResponse('Worksheet ID is required and must be a string', 400)
  }

  if (!/^[A-Za-z0-9_-]+$/.test(worksheetId)) {
    throw createErrorResponse('Invalid worksheet ID format', 400)
  }

  return { worksheetId }
}

async function initializeSupabase() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseKey) {
    throw createErrorResponse('Supabase configuration missing', 500, 'Server configuration error')
  }

  return createClient(supabaseUrl, supabaseKey)
}

async function fetchWorksheetData(supabase: any, worksheetId: string) {
  console.log(`Fetching worksheet data for ID: ${worksheetId}`)

  // Fetch worksheet metadata
  const { data: worksheet, error: worksheetError } = await supabase
    .from('worksheets')
    .select('*')
    .eq('id', worksheetId)
    .single()

  if (worksheetError) {
    console.error('Worksheet fetch error:', worksheetError)
    
    if (worksheetError.code === 'PGRST116') {
      throw createErrorResponse('Worksheet not found', 404, `No worksheet found with ID: ${worksheetId}`)
    }
    
    throw createErrorResponse('Database error while fetching worksheet', 500, worksheetError.message)
  }

  if (!worksheet) {
    throw createErrorResponse('Worksheet not found', 404, `No worksheet found with ID: ${worksheetId}`)
  }

  console.log(`Found worksheet: ${worksheet.document_name}`)

  // Fetch regions for this worksheet
  const { data: regions, error: regionsError } = await supabase
    .from('regions')
    .select('*')
    .eq('worksheet_id', worksheetId)
    .order('page', { ascending: true })
    .order('created_at', { ascending: true })

  if (regionsError) {
    console.error('Regions fetch error:', regionsError)
    throw createErrorResponse('Database error while fetching regions', 500, regionsError.message)
  }

  console.log(`Found ${regions?.length || 0} regions for worksheet`)

  return { worksheet, regions: regions || [] }
}

async function generatePdfUrl(supabase: any, worksheetId: string): Promise<string> {
  try {
    // Try to get PDF from private storage first
    const { data: pdfData, error: storageError } = await supabase.storage
      .from('private-pdfs')
      .createSignedUrl(`${worksheetId}.pdf`, 3600) // 1 hour expiry

    if (!storageError && pdfData?.signedUrl) {
      console.log(`Generated signed URL for PDF: ${worksheetId}.pdf`)
      return pdfData.signedUrl
    }

    console.log(`PDF not found in storage or error occurred, falling back to public URL. Error:`, storageError)
  } catch (error) {
    console.log(`Storage access failed, falling back to public URL. Error:`, error)
  }

  // Fallback to public URL
  const publicUrl = `/pdfs/${worksheetId}.pdf`
  console.log(`Using public PDF URL: ${publicUrl}`)
  return publicUrl
}

function transformWorksheetData(worksheet: any, regions: any[], pdfUrl: string): WorksheetResponse {
  return {
    meta: {
      documentName: worksheet.document_name || 'Unknown Document',
      documentId: worksheet.document_id || worksheet.id,
      drmProtectedPages: Array.isArray(worksheet.drm_protected_pages) ? worksheet.drm_protected_pages : [],
      drmProtected: Boolean(worksheet.drm_protected),
      regions: regions.map(region => ({
        id: region.id,
        document_id: worksheet.document_id || worksheet.id,
        user_id: 'system', // Since this is public data
        page: region.page,
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        type: region.type || 'area',
        name: region.name,
        description: Array.isArray(region.description) ? region.description : [],
        created_at: region.created_at || new Date().toISOString()
      }))
    },
    pdfUrl
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
    const { worksheetId } = await validateRequest(req)

    // Initialize Supabase
    const supabase = await initializeSupabase()

    // Fetch worksheet and regions data
    const { worksheet, regions } = await fetchWorksheetData(supabase, worksheetId)

    // Generate PDF URL
    const pdfUrl = await generatePdfUrl(supabase, worksheetId)

    // Transform and return data
    const responseData = transformWorksheetData(worksheet, regions, pdfUrl)
    
    console.log(`Successfully processed worksheet ${worksheetId}`)
    return createSuccessResponse(responseData)

  } catch (error) {
    // If error is already a Response (from our validation/error functions), return it
    if (error instanceof Response) {
      return error
    }

    // Handle unexpected errors
    console.error('Unexpected error in get-worksheet-data:', error)
    
    return createErrorResponse(
      'Internal server error', 
      500, 
      error instanceof Error ? error.message : 'Unknown error occurred'
    )
  }
})