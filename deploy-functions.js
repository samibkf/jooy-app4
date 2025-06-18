#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Deploying Supabase Edge Functions...\n');

// Check if Supabase CLI is available
try {
  execSync('supabase --version', { stdio: 'pipe' });
} catch (error) {
  console.error('❌ Supabase CLI not found. Please install it first:');
  console.error('npm install -g supabase');
  process.exit(1);
}

// Check if we're linked to a project
try {
  execSync('supabase status', { stdio: 'pipe' });
} catch (error) {
  console.error('❌ Not linked to a Supabase project. Please run:');
  console.error('supabase link --project-ref YOUR_PROJECT_REF');
  process.exit(1);
}

const functions = [
  'get-encrypted-worksheet',
  'get-worksheet-data',
  'setup-secrets'
];

console.log('📦 Functions to deploy:');
functions.forEach(func => console.log(`  - ${func}`));
console.log('');

// Deploy each function
for (const func of functions) {
  const funcPath = path.join('supabase', 'functions', func);
  
  if (!fs.existsSync(funcPath)) {
    console.log(`⚠️  Skipping ${func} - directory not found`);
    continue;
  }

  try {
    console.log(`📤 Deploying ${func}...`);
    execSync(`supabase functions deploy ${func}`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log(`✅ ${func} deployed successfully\n`);
  } catch (error) {
    console.error(`❌ Failed to deploy ${func}`);
    console.error(error.message);
    process.exit(1);
  }
}

console.log('🎉 All functions deployed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Set the PDF_ENCRYPTION_KEY secret in your Supabase dashboard');
console.log('2. Upload your PDF files to the storage buckets');
console.log('3. Test the application by scanning a QR code');
console.log('\n🔗 Visit /setup to check your configuration');