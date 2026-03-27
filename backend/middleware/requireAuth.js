const supabaseAdmin = require('../db/supabaseAdmin');

/**
 * Middleware to verify Supabase Access Token (JWT)
 * Expects header: Authorization: Bearer <token>
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the token via Supabase Admin Client
    // This is the definitive way to check if the session is still active/valid
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      console.error('[Auth] Token verification failed:', error?.message);
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // Attach user to req for downstream routes
    req.user = user;
    next();
  } catch (err) {
    console.error('[Auth] Error:', err.message);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

module.exports = requireAuth;
