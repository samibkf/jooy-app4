import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration. Please check your environment variables.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function uploadPDF() {
  try {
    console.log('Starting PDF upload process...')
    
    // Read the PDF file
    const pdfPath = join(__dirname, '../public/pdfs/ABCDE.pdf')
    console.log('Reading PDF from:', pdfPath)
    
    const pdfBuffer = readFileSync(pdfPath)
    console.log('PDF file read successfully, size:', pdfBuffer.length, 'bytes')
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('private-pdfs')
      .upload('pdfs/ABCDE.pdf', pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true // This will overwrite if file already exists
      })
    
    if (error) {
      console.error('Upload error:', error)
      process.exit(1)
    }
    
    console.log('PDF uploaded successfully!')
    console.log('Upload data:', data)
    
    // Verify the upload by trying to download
    console.log('Verifying upload...')
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('private-pdfs')
      .download('pdfs/ABCDE.pdf')
    
    if (downloadError) {
      console.error('Verification failed:', downloadError)
      process.exit(1)
    }
    
    console.log('Verification successful! Downloaded file size:', downloadData.size, 'bytes')
    console.log('Upload and verification completed successfully!')
    
  } catch (error) {
    console.error('Unexpected error:', error)
    process.exit(1)
  }
}

uploadPDF()