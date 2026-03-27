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
  console.log(`[WA:phone] 📞 Clean Pairing Session for ${userId}`);

  const existing = sessions.get(userId);
  if (existing) { try { existing.end(); } catch(e) {} sessions.delete(userId); }
  connecting.delete(userId);
  phonePairing.add(userId);

  // Aggressive wipe to break 405 locks
  await clearWhatsAppState(userId);
  const { state, saveCreds } = await useRedisAuthState(userId);

  const { version } = await fetchLatestBaileysVersion();
  
  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    logger,
    browser: Browsers.macOS('Desktop'),
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    markOnlineOnConnect: true,
  });

  sock.ev.on('creds.update', saveCreds);

  return new Promise((resolve, reject) => {
    let resolved = false;

    // Reject promise if connection closes prematurely
    const cleanup = () => { phonePairing.delete(userId); };

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      console.log(`[WA:phone] ${userId} | ${connection || 'handshaking'}`);

      // Official way: Request pairing code when QR is emitted or unregistered state confirmed
      // No artificial timeouts - let the socket dictate readiness
      if (qr && !resolved) {
        try {
          console.log(`[WA:phone] 📲 Requesting 8-digit code...`);
          const code = await sock.requestPairingCode(cleanPhone);
          const raw = String(code).replace(/-/g, '');
          const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
          
          if (io) io.to(userId).emit('whatsapp_pairing_code', { code: formatted });
          console.log(`[WA:phone] ✅ Code Ready: ${formatted}`);
          
          // We don't resolve yet - we stay in the promise to handle 'open' or 'close'
        } catch (err) {
          console.error(`[WA:phone] Pairing Error:`, err.message);
          if (!resolved) { resolved = true; reject(err); cleanup(); }
        }
      }

      if (connection === 'open') {
        console.log(`[WA:phone] 🎉 PAIRING SUCCESS`);
        resolved = true;
        cleanup();
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

        if (!resolved) {
            resolved = true;
            reject(new Error(`Link failed [${statusCode}]`));
            cleanup();
        } else if (!isLoggedOut) {
          setTimeout(() => connectWhatsApp(userId, io), 5000);
        }
      }
    });

    // Final safety resolve - the 8-digit code formatted is what the UI needs to 'start' its show
    // We resolve the INITIAL promise once the formatting happens above (within the qr block)
    // but the socket events keep running after this resolve for 'open'
    const origResolve = resolve;
    resolve = (val) => { resolved = true; origResolve(val); };
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
        printQRInTerminal: false,
        logger,
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
      });
      sock.ev.on('creds.update', saveCreds);
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr && io) { io.to(userId).emit('whatsapp_status', { status: 'qr_ready' }); io.to(userId).emit('whatsapp_qr', { qr }); }
        if (connection === 'open') {
          sessions.set(userId, sock);
          await supabaseAdmin.from('users').update({ whatsapp_connected: true }).eq('id', userId);
          if (io) io.to(userId).emit('whatsapp_status', { status: 'connected' });
        } else if (connection === 'close') {
          sessions.delete(userId);
          if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) setTimeout(() => connectWhatsApp(userId, io), 5000);
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
  if (!sock) throw new Error(`[WA] Not Found`);
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
