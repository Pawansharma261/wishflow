const { default: makeWASocket, DisconnectReason, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const useRedisAuthState = require('./useRedisAuthState');
const supabaseAdmin = require('../db/supabaseAdmin');

const sessions  = new Map();
const connecting = new Map();

const getWhatsAppStatus = (userId) => {
  if (sessions.get(userId)?.user) return 'connected';
  if (connecting.has(userId)) return 'connecting';
  return 'disconnected';
};

// ─────────────────────────────────────────────────────────────────
//  PHONE NUMBER PAIRING  (no QR scan — user types an 8-digit code)
// ─────────────────────────────────────────────────────────────────
const connectWhatsAppWithPhone = async (userId, phoneNumber, io) => {
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  console.log(`[WA:phone] Starting for userId=${userId} phone=${cleanPhone}`);

  // Kill any live session
  const existing = sessions.get(userId);
  if (existing) { try { existing.end(); } catch(e) {} sessions.delete(userId); }
  connecting.delete(userId);

  // Wipe Redis, then re-read fresh empty creds
  const { clearState: wipe } = await useRedisAuthState(userId);
  await wipe();
  const { state, saveCreds } = await useRedisAuthState(userId);
  console.log(`[WA:phone] Creds.registered=${state.creds.registered} after wipe`);

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    mobile: false,
    browser: Browsers.macOS('Desktop'),
    logger: pino({ level: 'warn' }),
    syncFullHistory: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
  });

  sock.ev.on('creds.update', saveCreds);
  sessions.set(userId, sock);

  // ── Correct Baileys phone-pairing pattern:
  //    requestPairingCode() is called when the FIRST connection.update arrives
  //    (socket is alive and ready) — it is NOT triggered by a 'qr' field.
  return new Promise((resolve, reject) => {
    let codeFetched = false;

    const hardTimeout = setTimeout(() => {
      console.error(`[WA:phone] 60s timeout for ${userId}`);
      try { sock.end(); } catch(e) {}
      sessions.delete(userId);
      reject(new Error('WhatsApp pairing timed out. Please try again.'));
    }, 60000);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      console.log(`[WA:phone] update for ${userId}: conn=${connection}`);

      // Attempt to get the pairing code on the very first update (socket is alive)
      if (!codeFetched && connection !== 'open' && connection !== 'close') {
        codeFetched = true;
        try {
          console.log(`[WA:phone] Calling requestPairingCode(${cleanPhone})...`);
          const rawCode = await sock.requestPairingCode(cleanPhone);
          console.log(`[WA:phone] Raw code returned: "${rawCode}"`);

          if (!rawCode) {
            clearTimeout(hardTimeout);
            try { sock.end(); } catch(e) {}
            sessions.delete(userId);
            return reject(new Error('WhatsApp returned an empty pairing code. Try again in 30s.'));
          }

          const formatted = String(rawCode).match(/.{1,4}/g)?.join('-') ?? String(rawCode);
          clearTimeout(hardTimeout);
          return resolve({ pairingCode: formatted });
        } catch (err) {
          clearTimeout(hardTimeout);
          console.error(`[WA:phone] requestPairingCode error:`, err.message);
          try { sock.end(); } catch(e) {}
          sessions.delete(userId);
          return reject(new Error('requestPairingCode() failed: ' + err.message));
        }
      }

      if (connection === 'open') {
        console.log(`[WA:phone] Connection opened for ${userId}`);
        sessions.set(userId, sock);
        await supabaseAdmin.from('users').update({ whatsapp_connected: true }).eq('id', userId);
        if (io) io.to(userId).emit('whatsapp_status', { status: 'connected' });
      } else if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        console.log(`[WA:phone] Connection closed for ${userId} code=${code}`);
        sessions.delete(userId);
        connecting.delete(userId);
        if (io) io.to(userId).emit('whatsapp_status', { status: 'disconnected' });
        if (code !== DisconnectReason.loggedOut) setTimeout(() => connectWhatsApp(userId, io), 5000);
      }
    });
  });
};

// ─────────────────────────────────────────────────────────────────
//  QR CODE CONNECTION  (traditional — user scans a QR)
// ─────────────────────────────────────────────────────────────────
const connectWhatsApp = async (userId, io) => {
  console.log(`[WA:qr] Connecting for userId=${userId}`);

  // Kill old session
  const existing = sessions.get(userId);
  if (existing) { try { existing.end(); } catch(e) {} sessions.delete(userId); }
  connecting.delete(userId);

  try {
    const connectionPromise = (async () => {
      const { state, saveCreds, clearState } = await useRedisAuthState(userId);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.macOS('Desktop'),
        logger: pino({ level: 'silent' }),
        syncFullHistory: false,
      });

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log(`[WA:qr] QR generated for ${userId}`);
          if (io) {
            io.to(userId).emit('whatsapp_status', { status: 'qr_ready' });
            io.to(userId).emit('whatsapp_qr', { qr });
          }
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          sessions.delete(userId);
          connecting.delete(userId);
          if (io) io.to(userId).emit('whatsapp_status', { status: 'disconnected', reason: statusCode !== DisconnectReason.loggedOut ? 'reconnecting' : 'loggedOut' });
          if (statusCode !== DisconnectReason.loggedOut) setTimeout(() => connectWhatsApp(userId, io), 5000);
          else { await clearState(); await supabaseAdmin.from('users').update({ whatsapp_connected: false }).eq('id', userId); }
        } else if (connection === 'open') {
          console.log(`[WA:qr] Opened for ${userId}`);
          sessions.set(userId, sock);
          await supabaseAdmin.from('users').update({ whatsapp_connected: true }).eq('id', userId);
          if (io) io.to(userId).emit('whatsapp_status', { status: 'connected' });
        }
      });

      return sock;
    })();

    connecting.set(userId, connectionPromise);
    return connectionPromise;
  } catch (outerError) {
    console.error(`[WA:qr] Outer setup error:`, outerError);
  }
};

// ─────────────────────────────────────────────────────────────────
//  SEND A WISH MESSAGE
// ─────────────────────────────────────────────────────────────────
const sendWhatsAppWish = async (userId, targetPhone, text) => {
  let sock = sessions.get(userId);
  if (!sock) {
    try {
      const result = await connecting.get(userId);
      sock = result || sessions.get(userId);
    } catch(e) {}
  }
  if (!sock) throw new Error(`[WA] No active session for ${userId}`);

  const jid = targetPhone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  await sock.sendMessage(jid, { text });
  console.log(`[WA] Sent wish to ${jid} for user ${userId}`);
};

// ─────────────────────────────────────────────────────────────────
//  DISCONNECT
// ─────────────────────────────────────────────────────────────────
const disconnectWhatsApp = async (userId) => {
  const sock = sessions.get(userId);
  if (sock) { try { await sock.logout(); } catch(e) {} sessions.delete(userId); }
  connecting.delete(userId);

  const { clearState } = await useRedisAuthState(userId);
  await clearState();
  await supabaseAdmin.from('users').update({ whatsapp_connected: false }).eq('id', userId);
  console.log(`[WA] Disconnected user ${userId}`);
};

module.exports = { connectWhatsApp, connectWhatsAppWithPhone, sendWhatsAppWish, disconnectWhatsApp, getWhatsAppStatus };
