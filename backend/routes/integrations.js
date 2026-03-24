const express = require('express');
const router = express.Router();
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

module.exports = router;
