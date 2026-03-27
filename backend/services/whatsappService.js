const { 
  default: makeWASocket, 
  DisconnectReason, 
  Browsers, 
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { useRedisAuthState, clearWhatsAppState } = require('./useRedisAuthState');
const supabaseAdmin = require('../db/supabaseAdmin');

const logBuffer = [];
const addLog = (msg) => {
  const timestamp = new Date().toISOString();
  logBuffer.push(`[${timestamp}] ${msg}`);
  if (logBuffer.length > 200) logBuffer.shift();
};

const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => { addLog(args.join(' ')); originalLog.apply(console, args); };
console.error = (...args) => { addLog(args.join(' error: ') + (args[1]?.stack || '')); originalError.apply(console, args); };

const sessions        = new Map();
const connecting      = new Map();
const phonePairing    = new Set();
const logger = pino({ level: 'silent' });

const getWhatsAppStatus = (userId) => {
  if (sessions.get(userId)?.user) return 'connected';
  if (connecting.has(userId)) return 'connecting';
  return 'disconnected';
};

const connectWhatsAppWithPhone = async (userId, phoneNumber, io) => {
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  console.log(`[WA:phone] 📞 Initializing linked session for ${userId}`);

  const existing = sessions.get(userId);
  if (existing) { try { existing.end(); } catch(e) {} sessions.delete(userId); }
  connecting.delete(userId);
  phonePairing.add(userId);

  // 1. Force state reset
  await clearWhatsAppState(userId);
  const { state, saveCreds } = await useRedisAuthState(userId);

  // 2. Use the SAME version as QR for stability
  const { version } = await fetchLatestBaileysVersion();
  
  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    browser: Browsers.macOS('Chrome'), // Consistent with high-success QR identity
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    markOnlineOnConnect: true,
    connectTimeoutMs: 120000,
  });

  sock.ev.on('creds.update', saveCreds);

  return new Promise((resolve, reject) => {
    let resolved = false;

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      console.log(`[WA:phone] ${userId} | ${connection || 'handshaking'}`);

      // SUCCESS: Request Pairing Code when the socket emits its first readiness pulse (QR or Unregistered)
      if (qr && !resolved) {
        try {
          console.log(`[WA:phone] 📲 Requesting pairing code for ${cleanPhone}...`);
          // SMALL SETTLE to ensure Redis keys are written
          await new Promise(r => setTimeout(r, 1000));
          const code = await sock.requestPairingCode(cleanPhone);
          const raw = String(code).replace(/-/g, '');
          const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
          
          if (io) io.to(userId).emit('whatsapp_pairing_code', { code: formatted });
          console.log(`[WA:phone] ✅ Code Delivered: ${formatted}`);
          
          // Note: We don't resolve the promise here, we wait for 'open' or 'close'
        } catch (err) {
          console.error(`[WA:phone] ❌ Pair Req Error:`, err.message);
          if (!resolved) { resolved = true; reject(err); phonePairing.delete(userId); }
        }
      }

      if (connection === 'open') {
        console.log(`[WA:phone] 🎉 PAIRING SUCCESSFUL`);
        resolved = true;
        phonePairing.delete(userId);
        sessions.set(userId, sock);
        await supabaseAdmin.from('users').update({ whatsapp_connected: true }).eq('id', userId);
        if (io) io.to(userId).emit('whatsapp_status', { status: 'connected' });
        resolve({ success: true });
      } else if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        if (io) {
          io.to(userId).emit('whatsapp_status', { 
            status: 'disconnected', 
            reason: statusCode, 
            shouldReconnect: !isLoggedOut 
          });
        }

        phonePairing.delete(userId);
        sessions.delete(userId);
        
        if (!resolved) {
            resolved = true;
            reject(new Error(`Pairing failed [${statusCode}]`));
        } else if (!isLoggedOut) {
          setTimeout(() => connectWhatsApp(userId, io), 5000);
        }
      }
    });

    // Background resolve for the controller if we don't hit success quickly
    setTimeout(() => { if(!resolved) resolve({ pending: true }); }, 15000);
  });
};

const connectWhatsApp = async (userId, io) => {
  const existing = sessions.get(userId);
  if (existing) { try { existing.end(); } catch(e) {} sessions.delete(userId); }
  connecting.delete(userId);

  try {
    const p = (async () => {
      const { state, saveCreds } = await useRedisAuthState(userId);
      const { version } = await fetchLatestBaileysVersion();
      const sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        browser: Browsers.macOS('Chrome'),
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
      });
      sock.ev.on('creds.update', saveCreds);
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr && io) { 
          io.to(userId).emit('whatsapp_status', { status: 'qr_ready' }); 
          io.to(userId).emit('whatsapp_qr', { qr }); 
        }
        if (connection === 'open') {
          sessions.set(userId, sock);
          await supabaseAdmin.from('users').update({ whatsapp_connected: true }).eq('id', userId);
          if (io) io.to(userId).emit('whatsapp_status', { status: 'connected' });
        } else if (connection === 'close') {
          sessions.delete(userId);
          if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) setTimeout(() => connectWhatsApp(userId, io), 5000);
          else {
              await clearWhatsAppState(userId);
              await supabaseAdmin.from('users').update({ whatsapp_connected: false }).eq('id', userId);
          }
        }
      });
      return sock;
    })();
    connecting.set(userId, p);
    return p;
  } catch(e) {}
};

const sendWhatsAppWish = async (userId, targetPhone, text) => {
  let sock = sessions.get(userId);
  if (!sock) { try { sock = await connecting.get(userId); } catch(e) {} sock = sock || sessions.get(userId); }
  if (!sock) throw new Error(`[WA] Not Connected`);
  const jid = targetPhone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  await sock.sendMessage(jid, { text });
};

const disconnectWhatsApp = async (userId) => {
  const sock = sessions.get(userId);
  if (sock) { try { await sock.logout(); } catch(e) {} sessions.delete(userId); }
  connecting.delete(userId);
  await clearWhatsAppState(userId);
  await supabaseAdmin.from('users').update({ whatsapp_connected: false }).eq('id', userId);
};

module.exports = { 
  connectWhatsApp, 
  connectWhatsAppWithPhone, 
  sendWhatsAppWish, 
  disconnectWhatsApp, 
  getWhatsAppStatus, 
  getLogs: () => logBuffer 
};
