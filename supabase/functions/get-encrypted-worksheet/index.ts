import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Helper function to convert an ArrayBuffer to a Base64 string for JSON transport
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse required IDs from the incoming request body
    const { worksheetId, userId } = await req.json();
    
    if (!worksheetId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or worksheetId' }), 
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create an admin client to securely access private storage
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Fetch the PDF file, supporting both new and old path structures for backward compatibility
    let fileData;
    
    // Try the new, user-specific path first
    let { data: newPathFile, error: newPathError } = await supabaseAdmin.storage
      .from('private-pdfs')
      .download(`${userId}/${worksheetId}.pdf`);

    if (newPathFile) {
      fileData = newPathFile;
    } else {
      // If that fails, try the old flat path for legacy files
      let { data: oldPathFile, error: oldPathError } = await supabaseAdmin.storage
        .from('private-pdfs')
        .download(`${worksheetId}.pdf`);
        
      if (oldPathFile) {
        fileData = oldPathFile;
      } else {
        // If neither path works, the file is not found
        console.error(`PDF not found for worksheetId: ${worksheetId}. Errors:`, { 
          newPathError, 
          oldPathError 
        });
        
        return new Response(
          JSON.stringify({ error: 'PDF not found.' }), 
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Encrypt the file using the secret key stored in Supabase secrets
    const key = Deno.env.get('PDF_ENCRYPTION_KEY');
    if (!key) {
      throw new Error("PDF_ENCRYPTION_KEY is not set in Supabase secrets.");
    }

    // Import the encryption key
    const cryptoKey = await crypto.subtle.importKey(
      'raw', 
      new TextEncoder().encode(key), 
      { name: 'AES-GCM' }, 
      false, 
      ['encrypt']
    );
    
    // Generate a random Initialization Vector (IV)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Convert file to ArrayBuffer and encrypt
    const fileBuffer = await fileData.arrayBuffer();
    const encryptedContent = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      fileBuffer
    );

    // Prepare and send the successful response payload
    const responsePayload = {
      encryptedPdf: arrayBufferToBase64(encryptedContent),
      iv: arrayBufferToBase64(iv), // The IV is required for decryption and is safe to send
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
    });

  } catch (err) {
    console.error("Error in get-encrypted-worksheet:", err);
    
    return new Response(
      JSON.stringify({ 
        error: err?.message ?? "An unexpected error occurred." 
      }), 
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});