const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env.local');
const content = fs.readFileSync(envPath, 'utf8');
const match = content.match(/FIREBASE_PRIVATE_KEY="([^"]+)"/);

if (match) {
  const pk = match[1];
  console.log('Length:', pk.length);
  console.log('Starts with BEGIN:', pk.startsWith('-----BEGIN PRIVATE KEY-----'));
  console.log('Ends with END (raw):', pk.endsWith('-----END PRIVATE KEY-----\\n'));
  console.log('Contains literal \\n:', pk.includes('\\n'));
  
  const processed = pk.replace(/\\n/g, '\n');
  console.log('Processed Ends with END:', processed.trim().endsWith('-----END PRIVATE KEY-----'));
  
  // Check for any weird characters
  const firstLines = processed.split('\n').slice(0, 2);
  console.log('First line:', firstLines[0]);
  console.log('Second line length:', firstLines[1]?.length);
} else {
  console.log('FIREBASE_PRIVATE_KEY not found or not in expected format (quoted)');
}
