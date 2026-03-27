require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const wishTrigger = require('./cron/wishTrigger');

const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Make io available globally to routes/services if needed
app.set('io', io);

const { getWhatsAppStatus, connectWhatsApp } = require('./services/whatsappService');
const supabaseAdmin = require('./db/supabaseAdmin');

// Handle socket connections
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  
  // Register user ID when they connect
  // Payload: { userId: string, token: string }
  socket.on('register', async (payload) => {
    const { userId, token } = typeof payload === 'string' ? { userId: payload } : payload;
    
    if (!token) {
      console.error(`[Socket] Auth failed for ${socket.id}: No token provided`);
      return socket.emit('auth_error', { message: 'Authentication required' });
    }

    try {
      // Validate token with Supabase Admin Client
      const cleanToken = token.replace('Bearer ', '');
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(cleanToken);

      if (error || !user || user.id !== userId) {
        console.error(`[Socket] Auth failed for ${socket.id}: Invalid token or mismatch`);
        return socket.emit('auth_error', { message: 'Invalid token or identity mismatch' });
      }

      console.log(`[Socket] Registered user: ${userId}`);
      socket.join(userId);

      // Auto-resume WhatsApp connection if previously connected according to DB
      const status = getWhatsAppStatus(userId);
      if (status === 'disconnected') {
        const { data } = await supabaseAdmin.from('users').select('whatsapp_connected').eq('id', userId).single();
        if (data?.whatsapp_connected) {
          console.log(`[Socket] Auto-resuming WA for user ${userId}`);
          connectWhatsApp(userId, io).catch(e => console.error('Auto-resume failed:', e.message));
          socket.emit('whatsapp_status', { status: 'connecting' });
        }
      } else {
        socket.emit('whatsapp_status', { status: status });
      }
    } catch (err) {
      console.error(`[Socket] Auth error for ${socket.id}:`, err.message);
      socket.emit('auth_error', { message: 'Internal authentication error' });
    }
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
  'http://localhost',
  'capacitor://localhost',
  'https://localhost',
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
// New integration & storage routes
app.use('/api/integrations', require('./routes/integrations'));
app.use('/api/storage', require('./routes/storage'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    app: 'WishFlow Backend (with WebSockets)',
    timestamp: new Date().toISOString()
  });
});

// Self-Heartbeat: Best-effort to prevent Render free tier from sleeping (Every 10 mins)
setInterval(() => {
  const SELF_URL = process.env.VITE_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';
  axios.get(`${SELF_URL}/health`).catch(() => {});
}, 10 * 60 * 1000); 

// Cron: Check every minute for due wishes
cron.schedule('* * * * *', () => {
  wishTrigger.checkAndSendWishes();
});

server.listen(PORT, () => {
  console.log(`[WishFlow] Server (HTTP + WS) running on port ${PORT} 🚀`);
});
