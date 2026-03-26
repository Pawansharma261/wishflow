const { default: makeWASocket, DisconnectReason, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const useRedisAuthState = require('./useRedisAuthState');
const supabaseAdmin = require('../db/supabaseAdmin');

// Keep connected sessions in memory for quick messaging (avoids reconnecting every message)
// If server restarts, they will be lazy-loaded on the next message
const sessions = new Map();
const connecting = new Map(); // Store connection promises to avoid double-init

/**
 * Get current connection status for a user
 */
const getWhatsAppStatus = (userId) => {
  const sock = sessions.get(userId);
  if (sock && sock.user) return 'connected';
  if (connecting.has(userId)) return 'connecting';
  return 'disconnected';
};

/**
 * Start or reconnect a WhatsApp session for a specific user
 * @param {string} userId - The unique ID of the user
 * @param {object} io - The global Socket.io instance
 */
/**
 * Connect WhatsApp using a Phone Number Pairing Code (no QR scan needed)
 * Baileys generates an 8-character code the user enters in WhatsApp > Linked Devices
 * @param {string} userId - The unique user ID
 * @param {string} phoneNumber - E.164 format e.g. "919876543210" (no + sign)
 * @param {object} io - Global Socket.io instance
 */
const connectWhatsAppWithPhone = async (userId, phoneNumber, io) => {
  console.log(`[WhatsApp] Phone pairing for ${userId}: ${phoneNumber}`);

  // Kill any existing session first
  const existing = sessions.get(userId);
  if (existing) {
    try { existing.end(); } catch(e) {}
    sessions.delete(userId);
  }
  connecting.delete(userId);

  // Step 1: Load state just to get the clearState function, then wipe everything
  const { clearState } = await useRedisAuthState(userId);
  console.log(`[WhatsApp] Wiping stale state for ${userId}...`);
  await clearState();

  // Step 2: Get a FRESH state (now Redis has no session, so initAuthCreds() is used)
  const { state, saveCreds } = await useRedisAuthState(userId);

  // Verify state is truly fresh (not registered)
  console.log(`[WhatsApp] Fresh creds registered: ${state.creds.registered} for ${userId}`);

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
  sessions.set(userId, sock);

  // Return a Promise that resolves when the pairing code is generated
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      try { sock.end(); } catch(e) {}
      sessions.delete(userId);
      connecting.delete(userId);
      reject(new Error('Timed out waiting for pairing code. Please try again.'));
    }, 60000);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // 'qr' event fires first — this is where we request the pairing code
      if (qr !== undefined) {
        try {
          console.log(`[WhatsApp] QR event fired for ${userId}, requesting pairing code...`);
          const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
          const code = await sock.requestPairingCode(cleanPhone);
          const formatted = code?.match(/.{1,4}/g)?.join('-') ?? code;
          console.log(`[WhatsApp] Pairing code generated for ${userId}: ${formatted}`);
          clearTimeout(timeout);
          // Don't resolve yet — keep socket alive for when user enters the code
          // Resolve with the code so the HTTP response can return it
          resolve({ sock, pairingCode: formatted });
        } catch (err) {
          clearTimeout(timeout);
          try { sock.end(); } catch(e) {}
          sessions.delete(userId);
          connecting.delete(userId);
          reject(new Error('requestPairingCode failed: ' + (err?.message ?? err)));
        }
        return;
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = (statusCode !== DisconnectReason.loggedOut);
        sessions.delete(userId);
        connecting.delete(userId);
        if (io) io.to(userId).emit('whatsapp_status', { status: 'disconnected' });
        if (shouldReconnect) setTimeout(() => connectWhatsApp(userId, io), 5000);
      } else if (connection === 'open') {
        console.log(`[WhatsApp] Phone-paired connection opened for ${userId}`);
        sessions.set(userId, sock);
        await supabaseAdmin.from('users').update({ whatsapp_connected: true }).eq('id', userId);
        if (io) io.to(userId).emit('whatsapp_status', { status: 'connected' });
      }
    });
  });
};

const connectWhatsApp = async (userId, io) => {
  // Logic Fix: Proactively clear any stuck connection state if this is called manually
  // We check if it's been in 'connecting' for too long, but for manual calls we just reset.
  console.log(`[WhatsApp] Connecting (Manual/Auto) for user ${userId}...`);
  
  try {
    // FORCE CLOSE any current in-memory session first
    const existing = sessions.get(userId);
    if (existing) {
      console.log(`[WhatsApp] Closing active memory session for ${userId} to allow fresh QR...`);
      try { existing.end(); } catch(e) {}
      sessions.delete(userId);
    }
    connecting.delete(userId); // Clear the promise to allow a new one

    const connectionPromise = (async () => {
      try {
        const { state, saveCreds, clearState } = await useRedisAuthState(userId);
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`[WhatsApp] Using WA v${version.join('.')}, isLatest: ${isLatest}`);

        const sock = makeWASocket({
          version,
          auth: state,
          printQRInTerminal: false,
          browser: Browsers.macOS('Desktop'),
          logger: pino({ level: 'silent' }), 
          generateHighQualityLinkPreview: true,
          syncFullHistory: false
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            console.log(`[WhatsApp] Generated QR for user ${userId}`);
            if (io) {
              io.to(userId).emit('whatsapp_status', { status: 'qr_ready' });
              io.to(userId).emit('whatsapp_qr', { qr });
            }
          }

          if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = (statusCode !== DisconnectReason.loggedOut);
            
            console.error(`[WhatsApp] Disconnected: `, lastDisconnect?.error);
            
            if (io) {
              io.to(userId).emit('whatsapp_status', { 
                status: 'disconnected', 
                reason: shouldReconnect ? 'reconnecting' : 'loggedOut' 
              });
            }

            if (shouldReconnect) {
              console.log(`[WhatsApp] Connection closed for ${userId} (Code: ${statusCode}), reconnecting...`);
              sessions.delete(userId);
              connecting.delete(userId);
              setTimeout(() => connectWhatsApp(userId, io), 5000); // Retry after 5 seconds
            } else {
              console.log(`[WhatsApp] Connection closed for ${userId}, logged out.`);
              sessions.delete(userId);
              connecting.delete(userId);
              await clearState();
              await supabaseAdmin.from('users').update({ whatsapp_connected: false }).eq('id', userId);
            }
          } else if (connection === 'open') {
            console.log(`[WhatsApp] Opened connection for ${userId}`);
            sessions.set(userId, sock); // Store the active session
            await supabaseAdmin.from('users').update({ whatsapp_connected: true }).eq('id', userId);
            if (io) {
              io.to(userId).emit('whatsapp_status', { status: 'connected' });
            }
          }
        });

        return sock;
      } catch (error) {
        console.error(`[WhatsApp] Error setting up for ${userId}:`, error.message);
        connecting.delete(userId);
        if (io) io.to(userId).emit('whatsapp_status', { status: 'error', message: error.message });
        throw error;
      }
    })();

    connecting.set(userId, connectionPromise);
    return connectionPromise;
  } catch (outerError) {
    console.error(`[WhatsApp] Outer setup error:`, outerError);
  }
};

/**
 * Send a WhatsApp wish using the connected session
 * @param {string} userId - The user sending the wish
 * @param {string} targetPhone - Contact's phone number
 * @param {string} text - The wish message
 */
const sendWhatsAppWish = async (userId, targetPhone, text) => {
  try {
    // Basic formatting for WhatsApp JID
    let cleanPhone = targetPhone.replace(/[\D]/g, '');
    if (!cleanPhone.endsWith('@s.whatsapp.net')) {
      cleanPhone = `${cleanPhone}@s.whatsapp.net`;
    }

    let sock = sessions.get(userId);
    
    // If no active memory session, try to boot it from Redis
    if (!sock) {
      console.log(`[WhatsApp] Session not in memory for ${userId}, booting temporarily...`);
      // We pass null for IO since this is a background job silently waking up
      sock = await connectWhatsApp(userId, null);
      
      // Wait for the socket to reach 'open' status so sendMessage doesn't falsely timeout
      await new Promise((resolve) => {
        let isResolved = false;
        
        // Setup listener
        const listener = (update) => {
          if (isResolved) return;
          if (update.connection === 'open') {
            isResolved = true;
            sock.ev.off('connection.update', listener);
            resolve();
          } else if (update.connection === 'close') {
            isResolved = true;
            sock.ev.off('connection.update', listener);
            resolve();
          }
        };
        sock.ev.on('connection.update', listener);

        // Failsafe 10-second timeout
        setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            sock.ev.off('connection.update', listener);
            console.log(`[WhatsApp] Waited 10s for open connection, proceeding to internal queue...`);
            resolve();
          }
        }, 10000);
      });
    }

    console.log(`[WhatsApp] Sending message from ${userId} to ${cleanPhone}...`);
    await sock.sendMessage(cleanPhone, { text });
    console.log(`[WhatsApp] Message successfully sent!`);
    return true;
  } catch (error) {
    console.error('[WhatsApp] Failed to send wish:', error);
    return false;
  }
};

/**
 * Disconnect and logout a WhatsApp session
 * @param {string} userId - The unique ID of the user
 */
const disconnectWhatsApp = async (userId) => {
  try {
    const sock = sessions.get(userId);
    if (sock) {
      await sock.logout(); // This terminates the session on WhatsApp's end too
      sessions.delete(userId);
    }
    connecting.delete(userId);
    
    // Reset DB status
    await supabaseAdmin.from('users').update({ whatsapp_connected: false }).eq('id', userId);
    
    // Clear Redis Auth State (best effort)
    const { clearState } = await useRedisAuthState(userId);
    await clearState();
    
    return true;
  } catch (err) {
    console.error(`[WhatsApp] Disconnect error for ${userId}:`, err.message);
    return false;
  }
};

module.exports = {
  connectWhatsApp,
  connectWhatsAppWithPhone,
  sendWhatsAppWish,
  getWhatsAppStatus,
  disconnectWhatsApp,
  sessions
};
