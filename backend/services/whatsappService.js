const { 
  default: makeWASocket, 
  DisconnectReason, 
  Browsers, 
  makeCacheableSignalKeyStore,
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
  console.log(`[WA:phone] 📞 Initializing Definitive Pairing for ${userId}`);

  const existing = sessions.get(userId);
  if (existing) { try { existing.end(); } catch(e) {} sessions.delete(userId); }
  connecting.delete(userId);
  phonePairing.add(userId);

  // 1. CLEAR STATE first
  await clearWhatsAppState(userId);
  const { state, saveCreds } = await useRedisAuthState(userId);

  // 2. CONSTRUCT Socket
  const sock = makeWASocket({
    version: [2, 3000, 1015901307],
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    browser: Browsers.ubuntu('Chrome'), // Solid Linux identity
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    markOnlineOnConnect: true,
    connectTimeoutMs: 120000,
    keepAliveIntervalMs: 25000,
  });

  sock.ev.on('creds.update', saveCreds);

  return new Promise((resolve, reject) => {
    let resolved = false;

    // FIX: Optimized ultra-early code request (Immediate)
    // We do NOT wait for 'connection.update' or 'qr'. 
    // This blocks background QR generation from desyncing the security keys.
    setTimeout(async () => {
        try {
            console.log(`[WA:phone] 🔑 Requesting 8-digit code...`);
            const code = await sock.requestPairingCode(cleanPhone);
            const raw = String(code).replace(/-/g, '');
            const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
            
            if (io) io.to(userId).emit('whatsapp_pairing_code', { code: formatted });
            console.log(`[WA:phone] ✅ PAIRING CODE: ${formatted}`);
        } catch (e) {
            console.error(`[WA:phone] Req Fail:`, e.message);
            if (!resolved) reject(e);
        }
    }, 1500);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      console.log(`[WA:phone] ${userId} | ${connection || 'handshaking'}`);

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
            reject(new Error(`Link failed [${statusCode}]`));
        } else if (!isLoggedOut) {
          setTimeout(() => connectWhatsApp(userId, io), 5000);
        }
      }
    });

    // Resolve initial call for the controller
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
      const sock = makeWASocket({
        version: [2, 3000, 1015901307],
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
        const { connection, lastDisconnect, qr } = update;
        if (qr && io) { io.to(userId).emit('whatsapp_status', { status: 'qr_ready' }); io.to(userId).emit('whatsapp_qr', { qr }); }
        if (connection === 'open') {
          sessions.set(userId, sock);
          supabaseAdmin.from('users').update({ whatsapp_connected: true }).eq('id', userId);
          if (io) io.to(userId).emit('whatsapp_status', { status: 'connected' });
        } else if (connection === 'close') {
          sessions.delete(userId);
          if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) setTimeout(() => connectWhatsApp(userId, io), 5000);
          else {
              clearWhatsAppState(userId);
              supabaseAdmin.from('users').update({ whatsapp_connected: false }).eq('id', userId);
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
