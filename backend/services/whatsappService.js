const {
  default: makeWASocket,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,  // ← CRITICAL: prevents signal key desync
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const useRedisAuthState = require('./useRedisAuthState');
const supabaseAdmin = require('../db/supabaseAdmin');

const sessions        = new Map();
const connecting      = new Map();
const phonePairing    = new Set();  // users currently in phone-pairing mode (don't QR-reconnect)

const logger = pino({ level: 'silent' });  // shared logger instance

const getWhatsAppStatus = (userId) => {
  if (sessions.get(userId)?.user) return 'connected';
  if (connecting.has(userId)) return 'connecting';
  return 'disconnected';
};

// ─────────────────────────────────────────────────────────────────────────────
//  PHONE NUMBER PAIRING
//  Follows the canonical Baileys example exactly:
//    1. Create socket
//    2. Call requestPairingCode() after 'connecting' status (NOT in connection.update)
//    3. Keep socket alive until user enters code
// ─────────────────────────────────────────────────────────────────────────────
const connectWhatsAppWithPhone = async (userId, phoneNumber, io) => {
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  console.log(`[WA:phone] userId=${userId} phone=${cleanPhone}`);

  // Kill any old socket
  const existing = sessions.get(userId);
  if (existing) { try { existing.end(); } catch(e) {} sessions.delete(userId); }
  connecting.delete(userId);
  phonePairing.delete(userId);

  // Wipe ALL Redis state (session + signal keys via SCAN)
  const { clearState } = await useRedisAuthState(userId);
  await clearState();

  // Load fresh state — creds are now initAuthCreds() (registered=false)
  const { state, saveCreds } = await useRedisAuthState(userId);
  console.log(`[WA:phone] creds.registered=${state.creds.registered} (must be false)`);

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      // makeCacheableSignalKeyStore prevents key desync that causes "Couldn't link device"
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    logger,
    browser: Browsers.ubuntu('Chrome'),         // stable browser fingerprint
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,                  // ping WA every 10s to stay connected
  });

  sock.ev.on('creds.update', () => saveCreds());
  sessions.set(userId, sock);
  phonePairing.add(userId);

  return new Promise((resolve, reject) => {
    let pairingRequested = false;

    const timeout = setTimeout(() => {
      console.error(`[WA:phone] Hard timeout for ${userId}`);
      phonePairing.delete(userId);
      try { sock.end(); } catch(e) {}
      sessions.delete(userId);
      reject(new Error('Pairing timed out (60s). Please try again.'));
    }, 60000);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      console.log(`[WA:phone] ${userId} | connection=${connection}`);

      // ── connection===undefined fires after WA server-hello handshake is complete
      //    (AFTER 'connecting', BEFORE 'open'). This is the correct moment to call
      //    requestPairingCode. Calling during 'connecting' causes "Connection Closed".
      if (!pairingRequested && connection === undefined) {
        pairingRequested = true;
        // 1.5s delay lets WA complete its internal key-exchange before we request
        await new Promise(r => setTimeout(r, 1500));
        try {
          console.log(`[WA:phone] requestPairingCode('${cleanPhone}')`);
          const rawCode = await sock.requestPairingCode(cleanPhone);
          if (!rawCode) throw new Error('Empty code returned by WhatsApp');
          const code = String(rawCode).replace(/(.{4})(.{4})/, '$1-$2');
          console.log(`[WA:phone] Code for ${userId}: ${code}`);
          clearTimeout(timeout);
          if (io) io.to(userId).emit('whatsapp_pairing_code', { code });
          return resolve({ pairingCode: code });
        } catch (err) {
          console.error(`[WA:phone] requestPairingCode error:`, err.message);
          clearTimeout(timeout);
          phonePairing.delete(userId);
          try { sock.end(); } catch(e) {}
          sessions.delete(userId);
          if (io) io.to(userId).emit('whatsapp_error', { message: 'Failed to get code: ' + err.message });
          return reject(err);
        }
      }

      if (connection === 'open') {
        console.log(`[WA:phone] ✅ LINKED! ${userId}`);
        phonePairing.delete(userId);
        sessions.set(userId, sock);
        await supabaseAdmin.from('users').update({ whatsapp_connected: true }).eq('id', userId);
        if (io) io.to(userId).emit('whatsapp_status', { status: 'connected' });
      } else if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        console.log(`[WA:phone] Close for ${userId} code=${code}`);

        // ── CRITICAL: In phone-pairing mode, NEVER auto-reconnect in QR mode.
        // The noise keys must remain intact for WhatsApp to complete the handshake.
        if (phonePairing.has(userId)) {
          console.log(`[WA:phone] Connection closed DURING pairing — NOT reconnecting as QR`);
          phonePairing.delete(userId);
          sessions.delete(userId);
          if (io) io.to(userId).emit('whatsapp_error', {
            message: 'Connection lost during pairing. Click "Get New Code" to retry.'
          });
        } else if (code !== DisconnectReason.loggedOut) {
          // Normal post-link disconnect — safe to reconnect in QR mode
          sessions.delete(userId);
          connecting.delete(userId);
          if (io) io.to(userId).emit('whatsapp_status', { status: 'disconnected' });
          setTimeout(() => connectWhatsApp(userId, io), 5000);
        } else {
          sessions.delete(userId);
          connecting.delete(userId);
          if (io) io.to(userId).emit('whatsapp_status', { status: 'disconnected' });
        }
      }
    });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
//  QR CODE CONNECTION
// ─────────────────────────────────────────────────────────────────────────────
const connectWhatsApp = async (userId, io) => {
  console.log(`[WA:qr] userId=${userId}`);

  const existing = sessions.get(userId);
  if (existing) { try { existing.end(); } catch(e) {} sessions.delete(userId); }
  connecting.delete(userId);

  try {
    const p = (async () => {
      const { state, saveCreds, clearState } = await useRedisAuthState(userId);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: false,
        logger,
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false,
        keepAliveIntervalMs: 10000,
      });

      sock.ev.on('creds.update', () => saveCreds());

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          if (io) { io.to(userId).emit('whatsapp_status', { status: 'qr_ready' }); io.to(userId).emit('whatsapp_qr', { qr }); }
        }

        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          sessions.delete(userId); connecting.delete(userId);
          if (io) io.to(userId).emit('whatsapp_status', { status: 'disconnected', reason: code !== DisconnectReason.loggedOut ? 'reconnecting' : 'loggedOut' });
          if (code !== DisconnectReason.loggedOut) setTimeout(() => connectWhatsApp(userId, io), 5000);
          else { await clearState(); await supabaseAdmin.from('users').update({ whatsapp_connected: false }).eq('id', userId); }
        } else if (connection === 'open') {
          sessions.set(userId, sock);
          await supabaseAdmin.from('users').update({ whatsapp_connected: true }).eq('id', userId);
          if (io) io.to(userId).emit('whatsapp_status', { status: 'connected' });
        }
      });
      return sock;
    })();
    connecting.set(userId, p);
    return p;
  } catch(e) { console.error(`[WA:qr]`, e); }
};

// ─────────────────────────────────────────────────────────────────────────────
//  SEND A WISH
// ─────────────────────────────────────────────────────────────────────────────
const sendWhatsAppWish = async (userId, targetPhone, text) => {
  let sock = sessions.get(userId);
  if (!sock) { try { sock = await connecting.get(userId); } catch(e) {} sock = sock || sessions.get(userId); }
  if (!sock) throw new Error(`No active WA session for ${userId}`);
  const jid = targetPhone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  await sock.sendMessage(jid, { text });
};

// ─────────────────────────────────────────────────────────────────────────────
//  DISCONNECT
// ─────────────────────────────────────────────────────────────────────────────
const disconnectWhatsApp = async (userId) => {
  phonePairing.delete(userId);
  const sock = sessions.get(userId);
  if (sock) { try { await sock.logout(); } catch(e) {} sessions.delete(userId); }
  connecting.delete(userId);
  const { clearState } = await useRedisAuthState(userId);
  await clearState();
  await supabaseAdmin.from('users').update({ whatsapp_connected: false }).eq('id', userId);
};

module.exports = { connectWhatsApp, connectWhatsAppWithPhone, sendWhatsAppWish, disconnectWhatsApp, getWhatsAppStatus };
