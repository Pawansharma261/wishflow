const fs = require('fs');
const path = require('path');

/**
 * Run this script locally to get the string you need to paste into 
 * your Render/Production environment variable: FIREBASE_SERVICE_ACCOUNT
 */

const keyPath = path.join(__dirname, '..', 'firebase-key.json');

if (!fs.existsSync(keyPath)) {
  console.error('\x1b[31mError: firebase-key.json not found in backend directory.\x1b[0m');
  process.exit(1);
}

try {
  const fileContent = fs.readFileSync(keyPath, 'utf8');
  const json = JSON.parse(fileContent);
  
  // Clean up private key specifically (ensuring \n characters are preserved in the string)
  const envString = JSON.stringify(json);
  
  console.log('\n\x1b[32m=== FIREBASE ENVIRONMENT VARIABLE ASSISTANT ===\x1b[0m\n');
  console.log('Copy the entire line below and paste it into Render as the VALUE for "FIREBASE_SERVICE_ACCOUNT":\n');
  console.log('\x1b[36m' + envString + '\x1b[0m\n');
  console.log('===============================================\n');

} catch (e) {
  console.error('\x1b[31mError processing key:\x1b[0m', e.message);
}
