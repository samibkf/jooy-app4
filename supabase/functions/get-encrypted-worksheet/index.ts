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

// Get encryption key from environment
const ENCRYPTION_KEY = Deno.env.get('PDF_ENCRYPTION_KEY')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { worksheetId, userId = 'anonymous' } = await req.json()

    if (!worksheetId) {
      return new Response(
        JSON.stringify({ error: 'worksheetId is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!ENCRYPTION_KEY) {
      console.error('PDF_ENCRYPTION_KEY not found in environment')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
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

    // Try to fetch PDF from private bucket first, fallback to public
    let pdfData: ArrayBuffer
    let pdfPath = `pdfs/${worksheetId}.pdf`
    
    try {
      // Try private bucket first
      const { data: privatePdfData, error: privateError } = await supabase.storage
        .from('private-pdfs')
        .download(pdfPath)

      if (privateError || !privatePdfData) {
        console.log('Private PDF not found, trying public bucket')
        
        // Fallback to public bucket
        const { data: publicPdfData, error: publicError } = await supabase.storage
          .from('pdfs')
          .download(pdfPath)

        if (publicError || !publicPdfData) {
          // Final fallback: try to fetch from public folder
          const publicUrl = `${supabaseUrl}/storage/v1/object/public/pdfs/${pdfPath}`
          const response = await fetch(publicUrl)
          
          if (!response.ok) {
            throw new Error(`PDF not found in any location: ${response.status}`)
          }
          
          pdfData = await response.arrayBuffer()
        } else {
          pdfData = await publicPdfData.arrayBuffer()
        }
      } else {
        pdfData = await privatePdfData.arrayBuffer()
      }
    } catch (error) {
      console.error('Error fetching PDF:', error)
      return new Response(
        JSON.stringify({ error: 'PDF file not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Encrypt the PDF data
    try {
      // Generate a random IV for this encryption
      const iv = crypto.getRandomValues(new Uint8Array(12)) // 12 bytes for AES-GCM
      
      // Import the encryption key
      const keyData = new TextEncoder().encode(ENCRYPTION_KEY)
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      )

      // Encrypt the PDF data
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        cryptoKey,
        pdfData
      )

      // Convert to base64 for transmission
      const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedData)))
      const ivBase64 = btoa(String.fromCharCode(...iv))

      // Log access for security monitoring
      console.log(`Secure PDF access: worksheetId=${worksheetId}, userId=${userId}, timestamp=${new Date().toISOString()}`)

      return new Response(
        JSON.stringify({
          meta: worksheetMeta,
          encryptedPdf: encryptedBase64,
          iv: ivBase64,
          encrypted: true
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } catch (encryptionError) {
      console.error('Error encrypting PDF:', encryptionError)
      return new Response(
        JSON.stringify({ error: 'Failed to encrypt PDF data' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    console.error('Error in get-encrypted-worksheet:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})