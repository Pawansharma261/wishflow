const { default: makeWASocket, DisconnectReason, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const useRedisAuthState = require('./useRedisAuthState');
const supabaseAdmin = require('../db/supabaseAdmin');

const sessions   = new Map();
const connecting = new Map();
// Track which sessions are waiting for phone pairing (don't auto-reconnect in QR mode)
const phonePairingSessions = new Set();

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
  phonePairingSessions.delete(userId);

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
    keepAliveIntervalMs: 10000,  // keep connection alive every 10s
  });

  sock.ev.on('creds.update', saveCreds);
  sessions.set(userId, sock);
  phonePairingSessions.add(userId);  // mark as phone-pairing mode

  return new Promise((resolve, reject) => {
    let codeFetched = false;

    const hardTimeout = setTimeout(() => {
      console.error(`[WA:phone] 60s timeout for ${userId}`);
      try { sock.end(); } catch(e) {}
      sessions.delete(userId);
      phonePairingSessions.delete(userId);
      reject(new Error('WhatsApp pairing timed out. Please try again.'));
    }, 60000);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      console.log(`[WA:phone] update for ${userId}: conn=${connection}`);

      // connection===undefined means WA server hello done — call requestPairingCode now
      if (!codeFetched && connection === undefined) {
        codeFetched = true;
        await new Promise(r => setTimeout(r, 1500)); // let WA finish handshake
        try {
          console.log(`[WA:phone] Calling requestPairingCode(${cleanPhone})...`);
          const rawCode = await sock.requestPairingCode(cleanPhone);
          console.log(`[WA:phone] Raw code returned: "${rawCode}"`);

          if (!rawCode) {
            clearTimeout(hardTimeout);
            phonePairingSessions.delete(userId);
            return reject(new Error('WhatsApp returned an empty pairing code. Try again.'));
          }

          const formatted = String(rawCode).match(/.{1,4}/g)?.join('-') ?? String(rawCode);
          clearTimeout(hardTimeout);

          // Emit to frontend via WebSocket ALSO (belt-and-suspenders)
          if (io) io.to(userId).emit('whatsapp_pairing_code', { code: formatted });

          return resolve({ pairingCode: formatted });
        } catch (err) {
          clearTimeout(hardTimeout);
          console.error(`[WA:phone] requestPairingCode error:`, err.message);
          phonePairingSessions.delete(userId);
          return reject(new Error('requestPairingCode() failed: ' + err.message));
        }
      }

      if (connection === 'open') {
        console.log(`[WA:phone] LINKED! Connection opened for ${userId}`);
        sessions.set(userId, sock);
        phonePairingSessions.delete(userId);
        await supabaseAdmin.from('users').update({ whatsapp_connected: true }).eq('id', userId);
        if (io) io.to(userId).emit('whatsapp_status', { status: 'connected' });
      } else if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log(`[WA:phone] Connection closed for ${userId} statusCode=${statusCode}`);
        sessions.delete(userId);
        connecting.delete(userId);

        // ── CRITICAL FIX: If in phone-pairing mode, do NOT reconnect in QR mode.
        // The session keys must stay intact for WhatsApp to complete the pairing handshake.
        // Only reconnect if we are already fully 'open' (connected) and got disconnected.
        if (phonePairingSessions.has(userId)) {
          console.log(`[WA:phone] Connection closed DURING pairing for ${userId} — NOT auto-reconnecting.`);
          phonePairingSessions.delete(userId);
          if (io) io.to(userId).emit('whatsapp_status', { status: 'disconnected' });
          if (io) io.to(userId).emit('whatsapp_error', { message: 'Connection lost during pairing. Please click "Get New Pairing Code" and try again.' });
        } else if (statusCode !== DisconnectReason.loggedOut) {
          // Normal post-open disconnect — reconnect in QR mode
          if (io) io.to(userId).emit('whatsapp_status', { status: 'disconnected' });
          setTimeout(() => connectWhatsApp(userId, io), 5000);
        } else {
          if (io) io.to(userId).emit('whatsapp_status', { status: 'disconnected' });
        }
      }
    });
  });
};

// ─────────────────────────────────────────────────────────────────
//  QR CODE CONNECTION  (traditional — user scans a QR)
// ─────────────────────────────────────────────────────────────────
const connectWhatsApp = async (userId, io) => {
  console.log(`[WA:qr] Connecting for userId=${userId}`);

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
        keepAliveIntervalMs: 10000,
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
          if (io) io.to(userId).emit('whatsapp_status', {
            status: 'disconnected',
            reason: statusCode !== DisconnectReason.loggedOut ? 'reconnecting' : 'loggedOut'
          });
          if (statusCode !== DisconnectReason.loggedOut) {
            setTimeout(() => connectWhatsApp(userId, io), 5000);
          } else {
            await clearState();
            await supabaseAdmin.from('users').update({ whatsapp_connected: false }).eq('id', userId);
          }
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
    try { sock = await connecting.get(userId); } catch(e) {}
    sock = sock || sessions.get(userId);
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
  phonePairingSessions.delete(userId);
  const sock = sessions.get(userId);
  if (sock) { try { await sock.logout(); } catch(e) {} sessions.delete(userId); }
  connecting.delete(userId);

  const { clearState } = await useRedisAuthState(userId);
  await clearState();
  await supabaseAdmin.from('users').update({ whatsapp_connected: false }).eq('id', userId);
  console.log(`[WA] Disconnected user ${userId}`);
};

module.exports = { connectWhatsApp, connectWhatsAppWithPhone, sendWhatsAppWish, disconnectWhatsApp, getWhatsAppStatus };
