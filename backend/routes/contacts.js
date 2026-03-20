const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../db/supabaseAdmin');

// Middleware to check user auth (simplified)
const authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' });
  
  req.user = user;
  next();
};

router.use(authenticateUser);

// Get all contacts
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('contacts').select('*').eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Create contact
router.post('/', async (req, res) => {
  const { name, relationship, phone_number, instagram_username, birthday, anniversary, callmebot_api_key } = req.body;
  const { data, error } = await supabaseAdmin.from('contacts').insert({
    user_id: req.user.id,
    name, relationship, phone_number, instagram_username, birthday, anniversary, callmebot_api_key
  }).select();
  
  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});

module.exports = router;
