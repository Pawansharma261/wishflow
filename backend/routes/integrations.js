const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabaseAdmin = require('../db/supabaseAdmin');
const { 
  connectWhatsApp, 
  connectWhatsAppWithPhone, 
  disconnectWhatsApp, 
  sendWhatsAppMediaMessage,
  postWhatsAppStatus,
  getLogs 
} = require('../services/whatsappService');
const requireAuth = require('../middleware/requireAuth');
const { pairPhoneLimiter, forceResetLimiter, sendLimiter } = require('../middleware/rateLimit');

// POST /api/integrations/whatsapp/connect
// Initiates the Baileys connection which will emit QR code to the user's socket room
// AUTH: REQUIRED
router.post('/whatsapp/connect', requireAuth, async (req, res) => {
  const userId = req.user.id; // Correct: Use verified ID from token
  const io = req.app.get('io');

  try {
    // Start the WhatsApp session generator for this user
    await connectWhatsApp(userId, io);
    res.json({ success: true, message: 'WhatsApp connection initiated. Listening on WebSockets.' });
  } catch (error) {
    console.error('[Integrations] WhatsApp connect error:', error.message);
    res.status(500).json({ error: 'Failed to initiate WhatsApp connection' });
  }
});

// POST /api/integrations/whatsapp/pair-phone
// Initiates a phone-number pairing flow (no QR code needed)
// AUTH: REQUIRED + RATE LIMIT (5/min)
router.post('/whatsapp/pair-phone', requireAuth, pairPhoneLimiter, async (req, res) => {
  const userId = req.user.id;
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });

  const io = req.app.get('io');
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  console.log(`[Integrations] Phone pairing for ${userId} -> ${cleanPhone}`);

  // Respond immediately so the HTTP connection doesn't timeout on Render free tier
  res.json({ success: true, message: 'Pairing started. Your code will arrive via WebSocket in 10-30s.' });

  // Run pairing in background — result is pushed via WebSocket from service layer
  setImmediate(async () => {
    try {
      // FIX: Service sends code via socket directly. No need for extra emitting here.
      await connectWhatsAppWithPhone(userId, cleanPhone, io);
    } catch (error) {
      console.error('[Integrations] Phone pairing failed:', error.message);
      if (io) io.to(userId).emit('whatsapp_error', { message: error.message });
    }
  });
});

/**
 * POST /api/integrations/whatsapp/send-media
 * Sends an image message with an optional caption.
 * AUTH: REQUIRED + RATE LIMIT (20/min)
 */
router.post('/whatsapp/send-media', requireAuth, sendLimiter, async (req, res) => {
  const userId = req.user.id;
  const { phoneNumber, mediaUrl, caption } = req.body;

  if (!phoneNumber || !mediaUrl) {
    return res.status(400).json({ error: 'phoneNumber and mediaUrl are required' });
  }

  try {
    const result = await sendWhatsAppMediaMessage(userId, phoneNumber, mediaUrl, caption || '');
    res.json(result);
  } catch (err) {
    console.error('[Integrations] send-media error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/integrations/whatsapp/post-status
 * Posts a text or image status/story to selected recipients.
 * AUTH: REQUIRED + RATE LIMIT (10/min)
 */
router.post('/whatsapp/post-status', requireAuth, sendLimiter, async (req, res) => {
  const userId = req.user.id;
  const { text, mediaUrl, recipients } = req.body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'A non-empty recipients array is required' });
  }

  if (!text && !mediaUrl) {
    return res.status(400).json({ error: 'Either text or mediaUrl must be provided for status' });
  }

  try {
    const result = await postWhatsAppStatus(userId, { text, mediaUrl, recipients });
    res.json(result);
  } catch (err) {
    console.error('[Integrations] post-status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/whatsapp/disconnect
// Clear active WhatsApp session and database status
// AUTH: REQUIRED
router.post('/whatsapp/disconnect', requireAuth, async (req, res) => {
  const userId = req.user.id;

  try {
    await disconnectWhatsApp(userId);
    res.json({ success: true, message: 'WhatsApp session disconnected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/whatsapp/force-reset
// Aggressively wipes ALL WhatsApp session data including all signal keys via SCAN
// AUTH: REQUIRED + RATE LIMIT (3/5min)
router.post('/whatsapp/force-reset', requireAuth, forceResetLimiter, async (req, res) => {
  const userId = req.user.id;

  try {
    console.log(`[Integrations] Deep force-reset for ${userId}`);

    // 1. Kill the in-memory socket
    await disconnectWhatsApp(userId).catch(() => {});

    // 2. Direct Redis SCAN — nukes EVERY key for this user regardless of service-level clearState
    const { Redis } = require('@upstash/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    const keysToDelete = [`whatsapp_session:${userId}`];

    // SCAN for all signal keys: whatsapp_keys:userId:*
    let cursor = 0;
    let scanned = 0;
    do {
      const result = await redis.scan(cursor, {
        match: `whatsapp_keys:${userId}:*`,
        count: 100,
      });
      // The scanner result is [nextCursor, keys[]]
      const nextCursor = result[0];
      const keys = result[1];
      cursor = Number(nextCursor);
      if (keys && keys.length > 0) keysToDelete.push(...keys);
      scanned++;
    } while (cursor !== 0 && scanned < 20); // safety cap

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
      console.log(`[Integrations] Deleted ${keysToDelete.length} Redis keys for ${userId}`);
    }

    res.json({ success: true, message: 'WhatsApp state fully wiped. You can try pairing now.', keysDeleted: keysToDelete.length });
  } catch (err) {
    console.error('[Integrations] force-reset error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/instagram/oauth
// Generates the OAuth URL for Instagram Basic Display + Messaging
router.get('/instagram/oauth', (req, res) => {
  const FACEBOOK_APP_ID = process.env.META_APP_ID; // 1960881724517689
  const REDIRECT_URI = process.env.FRONTEND_URL + '/settings'; // Where FB will redirect after login

  // Standard Meta OAuth Dialog
  const oauthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=instagram_basic,instagram_manage_messages`;
  
  res.json({ url: oauthUrl });
});

// POST /api/integrations/instagram/callback
// Exchanges the Facebook OAuth code for a Long-Lived Access Token
router.post('/instagram/callback', async (req, res) => {
  const { code, userId } = req.body;
  if (!code || !userId) return res.status(400).json({ error: 'Missing code or userId' });

  try {
    const FACEBOOK_APP_ID = process.env.META_APP_ID;
    const FACEBOOK_APP_SECRET = process.env.META_APP_SECRET;
    const REDIRECT_URI = process.env.FRONTEND_URL + '/settings';

    // 1. Exchange OAuth code for a Short-Lived User Access Token
    const tokenRes = await axios.get(`https://graph.facebook.com/v18.0/oauth/access_token?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${FACEBOOK_APP_SECRET}&code=${code}`);
    const shortLivedToken = tokenRes.data.access_token;

    // 2. Exchange Short-Lived token for a Long-Lived User Access Token (lasts 60 days)
    const longTokenRes = await axios.get(`https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&fb_exchange_token=${shortLivedToken}`);
    const longLivedToken = longTokenRes.data.access_token;

    // 3. Save the token mapped to the user in Supabase
    const { error } = await supabaseAdmin.from('users').update({ instagram_access_token: longLivedToken }).eq('id', userId);
    if (error) throw error;

    res.json({ success: true, message: 'Instagram successfully connected!' });
  } catch (error) {
    console.error('[Integrations] FB OAuth Callback Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to complete Facebook OAuth Token exchange.' });
  }
});

// GET /api/integrations/whatsapp/logs
router.get('/whatsapp/logs', (req, res) => {
  res.json({ logs: getLogs() });
});

module.exports = router;
