require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const wishTrigger = require('./cron/wishTrigger');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS — allow Vercel frontend & local dev
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://wishflow-five.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Routes
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/wishes', require('./routes/wishes'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/scheduler', require('./routes/scheduler'));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    app: 'WishFlow Backend',
    timestamp: new Date().toISOString()
  });
});

// Cron: Check every minute for due wishes
cron.schedule('* * * * *', () => {
  wishTrigger.checkAndSendWishes();
});

app.listen(PORT, () => {
  console.log(`[WishFlow] Server running on port ${PORT}`);
});
