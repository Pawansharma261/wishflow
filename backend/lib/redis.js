const { Redis } = require('@upstash/redis');

// Upstash Redis REST Client (Optimized for Render/Serverless)
const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = redisClient;
