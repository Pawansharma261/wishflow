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

      if (qr && !resolved) {
          try {
              console.log(`[WA:iron] 📲 Requesting pairing code for ${cleanPhone}`);
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

        // TERMINAL FAILURE: Explicit logout or missing credentials
        if (isLoggedOut || !credsRegistered) {
           console.log(`[WA:iron] 🚨 TERMINAL DISCONNECT for ${userId} (Reason: ${statusCode})`);
           await supabaseAdmin.from('users').update({ whatsapp_connected: false }).eq('id', userId);
           if (io) io.to(userId).emit('whatsapp_status', { status: 'disconnected', reason: 401 });
           
           if (!resolved) {
             resolved = true;
             reject(new Error(`Link failed [Logged Out]`));
           }
           sessions.delete(userId);
           phonePairing.delete(userId);
           return;
        }

        // TRANSIENT BLIP: Keep state stable, but try to reconnect in background
        console.log(`[WA:iron] ⏳ Transient close for ${userId} [${statusCode}]. Background retry...`);
        if (io) io.to(userId).emit('whatsapp_status', { status: 'connecting' });
        
        if (!resolved) {
           // If we're here, it means we weren't fully open yet, but we are registered. 
           // We keep the promise alive/pending while we resume.
           resolved = true;
           setTimeout(() => connectWhatsApp(userId, io), 5000);
           resolve({ success: true, resumed: true });
        } else {
           setTimeout(() => connectWhatsApp(userId, io), 5000);
        }
        sessions.delete(userId);
        phonePairing.delete(userId);
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

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr && io) { 
           io.to(userId).emit('whatsapp_status', { status: 'qr_ready' }); 
           io.to(userId).emit('whatsapp_qr', { qr }); 
        }

        if (connection === 'open') {
          console.log(`[WA:Service] ✅ Socket restored for ${userId}`);
          sessions.set(userId, sock);
          await supabaseAdmin.from('users').update({ whatsapp_connected: true }).eq('id', userId);
          if (io) io.to(userId).emit('whatsapp_status', { status: 'connected' });
        } else if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          
          if (isLoggedOut) {
             console.log(`[WA:Service] 🚨 Session Revoked for ${userId}`);
             await supabaseAdmin.from('users').update({ whatsapp_connected: false }).eq('id', userId);
             if (io) io.to(userId).emit('whatsapp_status', { status: 'disconnected', reason: 401 });
             sessions.delete(userId);
          } else {
             console.log(`[WA:Service] 🔄 Blip/Restart for ${userId} [${statusCode}]. Retrying in 5s...`);
             if (io) io.to(userId).emit('whatsapp_status', { status: 'connecting' });
             sessions.delete(userId);
             setTimeout(() => connectWhatsApp(userId, io), 5000);
          }
        }
      });
      return sock;
    })();
    connecting.set(userId, p);
    return p;
  } catch(e) {
    console.error(`[WA:Service] Setup Error for ${userId}:`, e.message);
  }
};

const getActiveSocket = async (userId) => {
  let sock = sessions.get(userId);
  if (!sock) {
     try {
       // Check if there is an in-progress connection attempt
       const p = connecting.get(userId);
       if (p) sock = await p;
     } catch (e) {
       console.error(`[WA:SocketSync] Failed to await connecting socket for ${userId}:`, e.message);
     }
  }
  // Double check sessions map in case 'open' event fired during await
  sock = sock || sessions.get(userId);
  return sock;
};

const sendWhatsAppWish = async (userId, targetPhone, text, mediaUrl = null) => {
  const sock = await getActiveSocket(userId);
  if (!sock) throw new Error(`WhatsApp session not active for user ${userId}`);

  const jid = targetPhone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  
  if (mediaUrl) {
    // Media Message with optional caption
    await sock.sendMessage(jid, { 
      image: { url: mediaUrl }, 
      caption: text || ''
    });
    return { success: true, type: 'image' };
  } else {
    // Traditional Text Message
    await sock.sendMessage(jid, { text });
    return { success: true, type: 'text' };
  }
};

const sendWhatsAppMediaMessage = async (userId, targetPhone, mediaUrl, caption = '') => {
  const sock = await getActiveSocket(userId);
  if (!sock) throw new Error(`WhatsApp session not active for user ${userId}`);

  const jid = targetPhone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  await sock.sendMessage(jid, { 
    image: { url: mediaUrl }, 
    caption: caption 
  });
  return { success: true };
};

/**
 * postWhatsAppStatus
 * Posts a text or image status/story.
 * status@broadcast requires a list of JIDs (statusJidList) that can see it.
 */
const postWhatsAppStatus = async (userId, { text = '', mediaUrl = '', recipients = [] }) => {
  const sock = await getActiveSocket(userId);
  if (!sock) throw new Error(`WhatsApp session not active for user ${userId}`);

  if (!recipients.length) throw new Error('Recipients list is mandatory for WhatsApp status visibility.');

  const statusJidList = recipients.map(r => r.replace(/[^0-9]/g, '') + '@s.whatsapp.net');

  if (mediaUrl) {
    // Image status
    await sock.sendMessage('status@broadcast', { 
       image: { url: mediaUrl }, 
       caption: text 
    }, { statusJidList });
    return { success: true, type: 'image_status' };
  } else {
    // Text status
    await sock.sendMessage('status@broadcast', { 
      text 
    }, { statusJidList });
    return { success: true, type: 'text_status' };
  }
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
  sendWhatsAppMediaMessage,
  postWhatsAppStatus,
  disconnectWhatsApp, 
  getWhatsAppStatus, 
  getLogs: () => logBuffer 
};
