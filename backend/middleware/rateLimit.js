/**
 * Simple in-memory rate limiter per user ID
 */
const rateLimitMap = new Map();

const rateLimiter = (options = { maxRequests: 5, windowMs: 60000 }) => {
  const { maxRequests, windowMs } = options;

  return (req, res, next) => {
    const userId = req.user?.id || req.body?.userId;
    if (!userId) return next();

    const now = Date.now();
    const limiterInfo = rateLimitMap.get(userId) || [];

    // Filter out requests older than the window
    const recentRequests = limiterInfo.filter(time => now - time < windowMs);

    if (recentRequests.length >= maxRequests) {
      console.warn(`[RateLimit] User ${userId} exceeded rate limit.`);
      return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }

    // Add current request
    recentRequests.push(now);
    rateLimitMap.set(userId, recentRequests);

    next();
  };
};

module.exports = {
  pairPhoneLimiter: rateLimiter({ maxRequests: 5, windowMs: 60000 }),     // 5 req / 1 min
  forceResetLimiter: rateLimiter({ maxRequests: 3, windowMs: 300000 }),   // 3 req / 5 min
};
