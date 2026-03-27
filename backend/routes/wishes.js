const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../db/supabaseAdmin');

const authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
};

router.use(authenticateUser);

router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('wishes')
    .select('*, contacts(name)')
    .eq('user_id', req.user.id)
    .order('scheduled_datetime', { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/', async (req, res) => {
  const { contact_id, occasion_type, wish_message, media_url, scheduled_datetime, channels, is_recurring, recurrence_rule } = req.body;
  const { data, error } = await supabaseAdmin.from('wishes').insert({
    user_id: req.user.id,
    contact_id, occasion_type, wish_message, media_url, scheduled_datetime, channels, is_recurring, recurrence_rule
  }).select();
  
  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});

router.post('/bulk-schedule', async (req, res) => {
  const { postType, text, mediaUrl, scheduledAt, recipients } = req.body;
  
  if (!recipients || !recipients.length) {
    return res.status(400).json({ error: 'Recipients list is required' });
  }

  try {
    const items = recipients.map(phone => {
      return {
        user_id: req.user.id,
        contact_id: null, // Basic version
        contact_name: (phone === 'status@broadcast' ? 'WhatsApp Status' : 'Broadcast Target'),
        contact_phone: phone,
        message: text,
        media_url: mediaUrl,
        scheduled_for: scheduledAt,
        status: 'pending',
        occasion_type: postType === 'status' ? 'status_story' : 'custom_broadcast',
        channels: ['whatsapp']
      };
    });

    const { data, error } = await supabaseAdmin.from('wishes').insert(items).select();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('[BulkSchedule] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

