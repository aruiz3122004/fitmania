const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const content = fs.readFileSync(envPath, 'utf8');

const idx = content.indexOf('HThI');
const slice = content.substring(idx, idx + 15);

console.log('String:', JSON.stringify(slice));
console.log('Char codes:');
for (let i = 0; i < slice.length; i++) {
  console.log(i, slice.charCodeAt(i), JSON.stringify(slice[i]));
}
