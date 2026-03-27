const b = require('@whiskeysockets/baileys');
console.log('makeCacheableSignalKeyStore:', typeof b.makeCacheableSignalKeyStore);
console.log('All exports:', Object.keys(b).filter(k => k.toLowerCase().includes('cache') || k.toLowerCase().includes('signal') || k.toLowerCase().includes('key')));
