const { 
  default: makeWASocket, 
  DisconnectReason, 
  Browsers, 
  fetchLatestBaileysVersion, 
  makeCacheableSignalKeyStore 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const useRedisAuthState = require('./useRedisAuthState');
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
  console.log(`[WA:phone] Starting pairing for ${userId} phone=${cleanPhone}`);

  const existing = sessions.get(userId);
  if (existing) { try { existing.end(); } catch(e) {} sessions.delete(userId); }
  connecting.delete(userId);
  phonePairing.add(userId);

  const { state, saveCreds, clearState } = await useRedisAuthState(userId);
  await clearState(); 

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
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
  });

  sock.ev.on('creds.update', () => saveCreds());

  return new Promise((resolve, reject) => {
    let pairingRequested = false;

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      console.log(`[WA:phone] ${userId} | connection=${connection}`);

      if (!pairingRequested && connection === undefined) {
        pairingRequested = true;
        await new Promise(r => setTimeout(r, 2500)); 
        try {
          console.log(`[WA:phone] Requesting code for ${userId}`);
          const rawCode = await sock.requestPairingCode(cleanPhone);
          const formatted = String(rawCode).replace(/(.{4})(.{4})/, '$1-$2');
          if (io) io.to(userId).emit('whatsapp_pairing_code', { code: formatted });
          resolve({ pairingCode: formatted });
        } catch (err) {
          console.error(`[WA:phone] requestPairingCode error:`, err.message);
          phonePairing.delete(userId);
          reject(err);
        }
      }

      if (connection === 'open') {
        console.log(`[WA:phone] ✅ LINKED! ${userId}`);
        phonePairing.delete(userId);
        sessions.set(userId, sock);
        await supabaseAdmin.from('users').update({ whatsapp_connected: true }).eq('id', userId);
        if (io) io.to(userId).emit('whatsapp_status', { status: 'connected' });
      } else if (connection === 'close') {
        const discCode = lastDisconnect?.error?.output?.statusCode;
        if (discCode === DisconnectReason.loggedOut) {
          phonePairing.delete(userId);
          sessions.delete(userId);
          await supabaseAdmin.from('users').update({ whatsapp_connected: false }).eq('id', userId);
          if (io) io.to(userId).emit('whatsapp_status', { status: 'disconnected' });
        } else if (!phonePairing.has(userId)) {
          setTimeout(() => connectWhatsApp(userId, io), 5000);
        }
      }
    });
  });
};

const connectWhatsApp = async (userId, io) => {
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
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: false,
        keepAliveIntervalMs: 30000,
      });
      sock.ev.on('creds.update', () => saveCreds());
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr && io) { io.to(userId).emit('whatsapp_status', { status: 'qr_ready' }); io.to(userId).emit('whatsapp_qr', { qr }); }
        if (connection === 'close') {
          const discCode = lastDisconnect?.error?.output?.statusCode;
          sessions.delete(userId);
          if (discCode !== DisconnectReason.loggedOut) setTimeout(() => connectWhatsApp(userId, io), 5000);
          else { await clearState(); await supabaseAdmin.from('users').update({ whatsapp_connected: false }).eq('id', userId); if (io) io.to(userId).emit('whatsapp_status', { status: 'disconnected' }); }
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
  } catch(e) {}
};

const sendWhatsAppWish = async (userId, targetPhone, text) => {
  let sock = sessions.get(userId);
  if (!sock) { try { sock = await connecting.get(userId); } catch(e) {} sock = sock || sessions.get(userId); }
  if (!sock) throw new Error(`[WA] Session Not Found ${userId}`);
  const jid = targetPhone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  await sock.sendMessage(jid, { text });
};

const disconnectWhatsApp = async (userId) => {
  phonePairing.delete(userId);
  const sock = sessions.get(userId);
  if (sock) { try { await sock.logout(); } catch(e) {} sessions.delete(userId); }
  connecting.delete(userId);
  const { clearState } = await useRedisAuthState(userId);
  await clearState();
  await supabaseAdmin.from('users').update({ whatsapp_connected: false }).eq('id', userId);
};

module.exports = { connectWhatsApp, connectWhatsAppWithPhone, sendWhatsAppWish, disconnectWhatsApp, getWhatsAppStatus, getLogs: () => logBuffer };
