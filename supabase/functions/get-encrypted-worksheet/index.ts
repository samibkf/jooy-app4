import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

// Helper function to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Helper function to convert hex string to ArrayBuffer
function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return bytes.buffer
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { worksheetId, userId } = await req.json()
    
    console.log('Processing request for:', { worksheetId, userId })

    if (!worksheetId) {
      return new Response(JSON.stringify({
        error: 'worksheetId is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!userId) {
      return new Response(JSON.stringify({
        error: 'userId is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Initialize Supabase client with service role key for storage access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('Supabase client initialized')

    // 1. Fetch the PDF from private storage
    const pdfPath = `pdfs/${worksheetId}.pdf`
    console.log('Fetching PDF from storage:', pdfPath)
    
    const { data: pdfData, error: storageError } = await supabase.storage
      .from('private-pdfs')
      .download(pdfPath)

    if (storageError) {
      console.error('Storage error:', storageError)
      return new Response(JSON.stringify({
        error: 'PDF not found in storage',
        details: storageError.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!pdfData) {
      return new Response(JSON.stringify({
        error: 'PDF data is null'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('PDF fetched successfully, size:', pdfData.size)

    // 2. Convert PDF Blob to ArrayBuffer
    const pdfArrayBuffer = await pdfData.arrayBuffer()
    console.log('PDF converted to ArrayBuffer, size:', pdfArrayBuffer.byteLength)

    // 3. Get encryption key from environment
    const encryptionKeyHex = Deno.env.get('VITE_PDF_ENCRYPTION_KEY')
    if (!encryptionKeyHex) {
      throw new Error('Encryption key not found in environment')
    }

    console.log('Encryption key found, length:', encryptionKeyHex.length)

    // 4. Convert hex key to ArrayBuffer and import as CryptoKey
    const keyBuffer = hexToArrayBuffer(encryptionKeyHex)
    console.log('Key buffer created, size:', keyBuffer.byteLength)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    )
    
    console.log('Crypto key imported successfully')

    // 5. Generate a random IV (16 bytes for AES-GCM)
    const iv = crypto.getRandomValues(new Uint8Array(16))
    console.log('IV generated, length:', iv.length)

    // 6. Encrypt the PDF data
    const encryptedPdfBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      pdfArrayBuffer
    )
    
    console.log('PDF encrypted successfully, size:', encryptedPdfBuffer.byteLength)

    // 7. Convert encrypted data and IV to Base64 for JSON transmission
    const encryptedPdfBase64 = arrayBufferToBase64(encryptedPdfBuffer)
    const ivBase64 = arrayBufferToBase64(iv.buffer)
    
    console.log('Data encoded to Base64:', {
      encryptedPdfLength: encryptedPdfBase64.length,
      ivLength: ivBase64.length
    })

    // 8. Return the encrypted data
    return new Response(JSON.stringify({
      encryptedPdf: encryptedPdfBase64,
      iv: ivBase64,
      success: true
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in get-encrypted-worksheet:', error)
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})