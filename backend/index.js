require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const wishTrigger = require('./cron/wishTrigger');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Make io available globally to routes/services if needed
app.set('io', io);

// Handle socket connections
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  
  // Register user ID when they connect
  socket.on('register', (userId) => {
    console.log(`[Socket] Registered user: ${userId}`);
    socket.join(userId); // Join a room specifically for this user's notifications
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;

// CORS — allow Vercel frontend & local dev
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://wishflow-five.vercel.app',
  'https://wishflow.in',
  'https://www.wishflow.in',
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
// New integration routes
app.use('/api/integrations', require('./routes/integrations'));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    app: 'WishFlow Backend (with WebSockets)',
    timestamp: new Date().toISOString()
  });
});

// Cron: Check every minute for due wishes
cron.schedule('* * * * *', () => {
  wishTrigger.checkAndSendWishes();
});

server.listen(PORT, () => {
  console.log(`[WishFlow] Server (HTTP + WS) running on port ${PORT}`);
});
