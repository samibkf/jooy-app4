#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables. Please check your .env file.');
  process.exit(1);
}

console.log('🧪 Testing Supabase Edge Functions...\n');

// Test functions
const tests = [
  {
    name: 'Setup Secrets Check',
    function: 'setup-secrets',
    body: { action: 'check-secrets' }
  },
  {
    name: 'Worksheet Data Fetch',
    function: 'get-worksheet-data',
    body: { worksheetId: 'ABCDE' }
  },
  {
    name: 'Encrypted Worksheet Fetch',
    function: 'get-encrypted-worksheet',
    body: { worksheetId: 'ABCDE', userId: 'test-user' }
  }
];

async function makeRequest(functionName, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/functions/v1/${functionName}`, SUPABASE_URL);
    
    const postData = JSON.stringify(body);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  for (const test of tests) {
    try {
      console.log(`🔍 Testing: ${test.name}`);
      const result = await makeRequest(test.function, test.body);
      
      if (result.status === 200) {
        console.log(`✅ ${test.name} - SUCCESS`);
        if (test.function === 'setup-secrets') {
          console.log(`   Status: ${result.data.status}`);
          console.log(`   Instructions: ${result.data.instructions}`);
        } else if (test.function === 'get-worksheet-data') {
          console.log(`   Document: ${result.data.meta?.documentName || 'Unknown'}`);
          console.log(`   Regions: ${result.data.meta?.regions?.length || 0}`);
        } else if (test.function === 'get-encrypted-worksheet') {
          console.log(`   Encrypted: ${result.data.encrypted ? 'Yes' : 'No'}`);
          console.log(`   Document: ${result.data.meta?.documentName || 'Unknown'}`);
        }
      } else {
        console.log(`❌ ${test.name} - FAILED (${result.status})`);
        console.log(`   Error: ${result.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} - ERROR`);
      console.log(`   ${error.message}`);
    }
    console.log('');
  }
}

runTests().then(() => {
  console.log('🏁 Testing complete!');
  console.log('\n📋 If any tests failed:');
  console.log('1. Check that your functions are deployed');
  console.log('2. Verify your environment variables');
  console.log('3. Ensure PDF_ENCRYPTION_KEY is set in Supabase');
  console.log('4. Check that your database schema is up to date');
}).catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});