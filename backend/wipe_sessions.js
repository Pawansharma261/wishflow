const { clearWhatsAppState } = require('./services/useRedisAuthState');
const supabaseAdmin = require('./db/supabaseAdmin');

async function wipeAllSessions() {
  console.log('[Wipe] 🧹 Initiating global session cleanup...');
  
  try {
    // 1. Fetch all users who have a WhatsApp connection flag
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('whatsapp_connected', true);

    if (error) throw error;

    console.log(`[Wipe] Found ${users?.length || 0} active sessions.`);

    for (const user of users) {
      console.log(`[Wipe] Clearing session for user: ${user.id}`);
      await clearWhatsAppState(user.id);
      
      // 2. Reset the connection flag to force re-pair
      await supabaseAdmin
        .from('users')
        .update({ whatsapp_connected: false })
        .eq('id', user.id);
    }

    console.log('[Wipe] ✅ Global session cleanup complete. All users must re-pair.');
    process.exit(0);
  } catch (err) {
    console.error('[Wipe] ❌ Cleanup failed:', err.message);
    process.exit(1);
  }
}

wipeAllSessions();
