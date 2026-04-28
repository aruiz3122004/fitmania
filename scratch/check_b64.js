const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env.local');
const content = fs.readFileSync(envPath, 'utf8');

const match = content.match(/FIREBASE_PRIVATE_KEY_B64="([^"]+)"/);

if (match) {
  const b64 = match[1];
  try {
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    console.log('Decoded length:', decoded.length);
    console.log('Starts with BEGIN:', decoded.startsWith('-----BEGIN PRIVATE KEY-----'));
    console.log('Ends with END:', decoded.trim().endsWith('-----END PRIVATE KEY-----'));
    
    // Check for common pitfalls like extra spaces or weird line endings
    const lines = decoded.split('\n');
    console.log('Number of lines:', lines.length);
    console.log('First line:', JSON.stringify(lines[0]));
    console.log('Last line:', JSON.stringify(lines[lines.length-1]));
  } catch (e) {
    console.error('Error decoding base64:', e);
  }
} else {
  console.log('FIREBASE_PRIVATE_KEY_B64 not found');
}
