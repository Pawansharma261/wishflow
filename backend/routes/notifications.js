const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../db/supabaseAdmin');

// Register device for push notifications
router.post('/register-device', async (req, res) => {
  const { userId, fcmToken } = req.body;
  if (!userId || !fcmToken) return res.status(400).json({ error: 'Missing userId or fcmToken' });

  try {
    const { error } = await supabaseAdmin
      .from('user_devices')
      .upsert({ user_id: userId, fcm_token: fcmToken });

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
