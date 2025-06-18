import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const { action, secretName, secretValue } = await req.json()

    if (action === 'check-secrets') {
      // Check if required secrets are available
      const pdfKey = Deno.env.get('PDF_ENCRYPTION_KEY')
      
      return new Response(
        JSON.stringify({
          secrets: {
            PDF_ENCRYPTION_KEY: pdfKey ? 'Set' : 'Missing',
          },
          status: pdfKey ? 'Ready' : 'Needs Configuration',
          instructions: pdfKey ? 'All secrets are configured!' : 'Please set PDF_ENCRYPTION_KEY in Supabase Edge Functions settings'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (action === 'test-encryption') {
      const pdfKey = Deno.env.get('PDF_ENCRYPTION_KEY')
      
      if (!pdfKey) {
        return new Response(
          JSON.stringify({ error: 'PDF_ENCRYPTION_KEY not found' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Test encryption/decryption
      const testData = new TextEncoder().encode('Test PDF data')
      const iv = crypto.getRandomValues(new Uint8Array(12))
      
      const keyData = new TextEncoder().encode(pdfKey)
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      )

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        cryptoKey,
        testData
      )

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        cryptoKey,
        encrypted
      )

      const decryptedText = new TextDecoder().decode(decrypted)
      
      return new Response(
        JSON.stringify({
          success: decryptedText === 'Test PDF data',
          message: 'Encryption/decryption test completed successfully'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in setup-secrets:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})