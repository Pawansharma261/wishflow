const redisClient = require('./lib/redis');
const supabaseAdmin = require('./db/supabaseAdmin');

async function wipeAllSessions() {
  console.log('[Wipe] 🧹 Initiating deep-scan Redis session cleanup...');
  
  try {
    // 1. Scan Redis for ALL session namespaces (legacy and new)
    const patterns = ['wa_session:*', 'whatsapp_session:*', 'whatsapp_keys:*'];
    let totalPurged = 0;

    for (const pattern of patterns) {
      const keys = await redisClient.keys(pattern);
      if (keys && keys.length > 0) {
        await redisClient.del(...keys);
        totalPurged += keys.length;
        console.log(`[Wipe] Purged ${keys.length} keys from ${pattern}`);
      }
    }
    
    console.log(`[Wipe] Total cleanup: ${totalPurged} keys purged.`);

    // 3. Reset DB flags with safety check
    try {
      const { error } = await supabaseAdmin.from('users').update({ whatsapp_connected: false });
      if (error && error.message.includes('column')) {
        console.warn('[Wipe] Note: Column whatsapp_connected missing, skipped DB reset.');
      }
    } catch (e) {
      console.warn('[Wipe] DB reset failed (ignoring):', e.message);
    }

    console.log('[Wipe] ✅ Production session cleanup complete. All users must re-pair.');
    process.exit(0);
  } catch (err) {
    console.error('[Wipe] ❌ Cleanup failed:', err.message);
    process.exit(1);
  }
}

wipeAllSessions();
