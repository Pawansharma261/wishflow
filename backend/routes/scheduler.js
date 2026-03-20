const express = require('express');
const router = express.Router();
const wishTrigger = require('../cron/wishTrigger');

// Manually trigger the wish scheduler (for testing)
router.post('/trigger', async (req, res) => {
  try {
    await wishTrigger.checkAndSendWishes();
    res.json({ success: true, message: 'Scheduler triggered' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
