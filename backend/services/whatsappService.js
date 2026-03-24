const { default: makeWASocket, DisconnectReason, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const useRedisAuthState = require('./useRedisAuthState');
const supabaseAdmin = require('../db/supabaseAdmin');

// Keep connected sessions in memory for quick messaging (avoids reconnecting every message)
// If server restarts, they will be lazy-loaded on the next message
const sessions = new Map();

/**
 * Start or reconnect a WhatsApp session for a specific user
 * @param {string} userId - The unique ID of the user
 * @param {object} io - The global Socket.io instance
 */
const connectWhatsApp = async (userId, io) => {
  console.log(`[WhatsApp] Connecting for user ${userId}...`);
  try {
    const { state, saveCreds, clearState } = await useRedisAuthState(userId);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[WhatsApp] Using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.macOS('Desktop'),
      logger: pino({ level: 'silent' }), // Switched back to silent
      generateHighQualityLinkPreview: true,
      syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`[WhatsApp] Generated QR for user ${userId}`);
        if (io) {
          io.to(userId).emit('whatsapp_qr', { qr });
        }
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = (statusCode !== DisconnectReason.loggedOut);
        
        console.error(`[WhatsApp] Disconnected: `, lastDisconnect?.error);
        
        if (io) {
          io.to(userId).emit('whatsapp_status', { status: 'disconnected', reason: shouldReconnect ? 'reconnecting' : 'loggedOut' });
        }

        if (shouldReconnect) {
          console.log(`[WhatsApp] Connection closed for ${userId} (Code: ${statusCode}), reconnecting...`);
          sessions.delete(userId);
          setTimeout(() => connectWhatsApp(userId, io), 3000); // Retry after 3 seconds
        } else {
          console.log(`[WhatsApp] Connection closed for ${userId}, logged out.`);
          sessions.delete(userId);
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

    // Handle messages / incoming updates if needed later
    // sock.ev.on('messages.upsert', async m => { ... })

    return sock;
  } catch (error) {
    console.error(`[WhatsApp] Error setting up for ${userId}:`, error.message);
    if (io) io.to(userId).emit('whatsapp_status', { status: 'error', message: error.message });
    throw error;
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

module.exports = {
  connectWhatsApp,
  sendWhatsAppWish,
  sessions
};
