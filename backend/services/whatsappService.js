const { 
  default: makeWASocket, 
  DisconnectReason, 
  Browsers, 
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion, // Added missing import
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

/**
 * connectWhatsAppWithPhone - IRONCLAD VERSION
 * Hardcoded stable version + Handshake-Sync logic.
 */
const connectWhatsAppWithPhone = async (userId, phoneNumber, io) => {
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  console.log(`[WA:iron] ⚡ Starting Isolated Link for ${userId}`);

  const existing = sessions.get(userId);
  if (existing) { try { existing.end(); } catch(e) {} sessions.delete(userId); }
  connecting.delete(userId);
  phonePairing.add(userId);

  // 1. Mandatory Clean Start
  await clearWhatsAppState(userId);
  const { state, saveCreds } = await useRedisAuthState(userId);

  // 2. Ironclad Socket Config (Dynamic version + standard Linux profile prevents 405)
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    browser: Browsers.ubuntu('Chrome'), 
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    markOnlineOnConnect: true,
    connectTimeoutMs: 120000,
    keepAliveIntervalMs: 25000,
  });

  sock.ev.on('creds.update', saveCreds);

  return new Promise((resolve, reject) => {
    let resolved = false;

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      console.log(`[WA:iron] ${userId} | ${connection || 'handshaking'}`);

      // SUCCESS: Request when socket is actually ready (bypasses 405 method not allowed)
      if (qr && !resolved) {
          try {
              console.log(`[WA:iron] 📲 Requesting pairing code for ${cleanPhone}`);
              // Micro-delay to avoid rate-limiting on Baileys handshake
              setTimeout(async () => {
                  try {
                      const code = await sock.requestPairingCode(cleanPhone);
                      const raw = String(code).replace(/-/g, '');
                      const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
                      
                      if (io) io.to(userId).emit('whatsapp_pairing_code', { code: formatted });
                      console.log(`[WA:iron] ✅ PAIRING CODE: ${formatted}`);
                  } catch (e) {
                      console.error(`[WA:iron] ❌ Link Req Fail:`, e.message);
                      if (!resolved) { resolved = true; reject(e); phonePairing.delete(userId); }
                  }
              }, 1000);
          } catch (err) {
              console.error(`[WA:iron] ❌ Link Request Failed:`, err.message);
              if (!resolved) { resolved = true; reject(err); phonePairing.delete(userId); }
          }
      }

      if (connection === 'open') {
        console.log(`[WA:iron] 🎉 LINK SUCCESS`);
        resolved = true;
        phonePairing.delete(userId);
        sessions.set(userId, sock);
        await supabaseAdmin.from('users').update({ whatsapp_connected: true }).eq('id', userId);
        if (io) io.to(userId).emit('whatsapp_status', { status: 'connected' });
        resolve({ success: true });
      } else if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const credsRegistered = !!state?.creds?.registered;

        if (!resolved) {
            // FIX: If socket closes but we are registered, it's NOT a fail — just resume
            if (!isLoggedOut && credsRegistered) {
                console.log(`[WA:iron] Resuming registered session for ${userId}`);
                resolved = true;
                phonePairing.delete(userId);
                if (io) io.to(userId).emit('whatsapp_status', { status: 'connecting' });
                setTimeout(() => connectWhatsApp(userId, io), 2000);
                resolve({ success: true, resumed: true });
                return;
            }

            resolved = true;
            if (io) io.to(userId).emit('whatsapp_status', { status: 'disconnected', reason: statusCode });
            reject(new Error(`Link failed [${statusCode}]`));
        } else {
            if (io) io.to(userId).emit('whatsapp_status', { status: 'disconnected', reason: statusCode });
            if (!isLoggedOut) {
              setTimeout(() => connectWhatsApp(userId, io), 5000);
            }
        }

        phonePairing.delete(userId);
        sessions.delete(userId);
      }
    });

    setTimeout(() => { if(!resolved && !phonePairing.has(userId)) resolve({ pending: true }); }, 15000);
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
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
      });
      sock.ev.on('creds.update', saveCreds);
      sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        if (qr && io) { io.to(userId).emit('whatsapp_status', { status: 'qr_ready' }); io.to(userId).emit('whatsapp_qr', { qr }); }
        if (connection === 'open') {
          sessions.set(userId, sock);
          supabaseAdmin.from('users').update({ whatsapp_connected: true }).eq('id', userId);
          if (io) io.to(userId).emit('whatsapp_status', { status: 'connected' });
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
  if (!sock) throw new Error(`[WA] Session Null`);
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
