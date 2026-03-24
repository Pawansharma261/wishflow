const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabaseAdmin = require('../db/supabaseAdmin');
const { connectWhatsApp } = require('../services/whatsappService');

// POST /api/integrations/whatsapp/connect
// Initiates the Baileys connection which will emit QR code to the user's socket room
router.post('/whatsapp/connect', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID is required' });

  // Get the global Socket.io instance attached to the app in index.js
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

module.exports = router;
