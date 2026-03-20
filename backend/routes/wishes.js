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

module.exports = router;
