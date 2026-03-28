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
    .order('scheduled_for', { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/', async (req, res) => {
  const { contact_id, occasion_type, message, media_url, scheduled_for, channels, is_recurring, recurrence_rule } = req.body;
  const { data, error } = await supabaseAdmin.from('wishes').insert({
    user_id: req.user.id,
    contact_id, occasion_type, message, media_url, scheduled_for, channels, is_recurring, recurrence_rule
  }).select();
  
  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});

router.post('/bulk-schedule', async (req, res) => {
  const { postType, text, mediaUrl, scheduledAt, recipients } = req.body;
  console.log(`[BulkSchedule] Request for type: ${postType}, Recipients: ${recipients?.length}`);
  
  if (!recipients || !recipients.length) {
    return res.status(400).json({ error: 'Recipients list is required' });
  }

  try {
    // 1. Fetch a fallback contact ID to satisfy the NOT NULL constraint if needed
    const { data: contact } = await supabaseAdmin.from('contacts').select('id').eq('user_id', req.user.id).limit(1).single();
    if (!contact && postType === 'status') {
       return res.status(400).json({ error: 'Please add at least one contact first to initialize the status hub.' });
    }

    const items = recipients.map(phone => {
      return {
        user_id: req.user.id,
        contact_id: contact?.id || null, // Fallback for schema compliance
        occasion_type: 'custom', // Limited by ENUM occasion_type
        message: text,
        media_url: mediaUrl,
        scheduled_for: scheduledAt,
        status: 'pending',
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

