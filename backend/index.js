require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const wishTrigger = require('./cron/wishTrigger');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const contactsRouter = require('./routes/contacts');
const wishesRouter = require('./routes/wishes');
const notificationsRouter = require('./routes/notifications');
const schedulerRouter = require('./routes/scheduler');

app.use('/api/contacts', contactsRouter);
app.use('/api/wishes', wishesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/scheduler', schedulerRouter);

app.get('/', (req, res) => {
  res.send('WishFlow Backend API is running...');
});

// Start Cron Job (Every minute)
cron.schedule('* * * * *', () => {
  console.log('Running wish scheduler...');
  wishTrigger.checkAndSendWishes();
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
