const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { Redis } = require('@upstash/redis');

module.exports = async function useRedisAuthState(userId) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Upstash Redis credentials are missing in Environment Variables.');
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const sessionKey = `whatsapp_session:${userId}`;
  const keysPrefix = `whatsapp_keys:${userId}:`;   // NOTE: keys are PREFIX:category-id

  const readData = async (key) => {
    try {
      const data = await redis.get(key);
      if (data) {
        const str = typeof data === 'string' ? data : JSON.stringify(data);
        return JSON.parse(str, BufferJSON.reviver);
      }
      return null;
    } catch (err) {
      console.error('[RedisAuthState] read error', err);
      return null;
    }
  };

  const writeData = async (key, data) => {
    try {
      const str = JSON.stringify(data, BufferJSON.replacer);
      await redis.set(key, str, { ex: 2592000 });
    } catch (err) {
      console.error('[RedisAuthState] write error', err);
    }
  };

  // ── Scan + delete all keys matching a prefix (Upstash supports SCAN) ──────
  const scanAndDelete = async (matchPattern) => {
    let cursor = 0;
    let totalDeleted = 0;
    try {
      do {
        const [nextCursor, keys] = await redis.scan(cursor, {
          match: matchPattern,
          count: 100,
        });
        cursor = Number(nextCursor);
        if (keys && keys.length > 0) {
          await redis.del(...keys);
          totalDeleted += keys.length;
        }
      } while (cursor !== 0);
    } catch (e) {
      console.error('[RedisAuthState] scanAndDelete error:', e.message);
    }
    return totalDeleted;
  };

  let creds = await readData(sessionKey);
  if (!creds) creds = initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          if (!ids || ids.length === 0) return {};
          const data = {};
          try {
            // Key format: whatsapp_keys:userId:category-id
            const allKeys = ids.map(id => `${keysPrefix}${type}-${id}`);
            const values = await redis.mget(...allKeys);
            ids.forEach((id, idx) => {
              let value = values[idx];
              if (value) {
                const str = typeof value === 'string' ? value : JSON.stringify(value);
                value = JSON.parse(str, BufferJSON.reviver);
                if (type === 'app-state-sync-key') {
                  value = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value);
                }
                data[id] = value;
              }
            });
          } catch (e) {
            console.error('[RedisAuthState] mget error:', e);
          }
          return data;
        },
        set: async (data) => {
          try {
            const p = redis.pipeline();
            let ops = 0;
            for (const category in data) {
              for (const id in data[category]) {
                const value = data[category][id];
                // Key format: whatsapp_keys:userId:category-id
                const key = `${keysPrefix}${category}-${id}`;
                if (value) {
                  p.set(key, JSON.stringify(value, BufferJSON.replacer), { ex: 2592000 });
                } else {
                  p.del(key);
                }
                ops++;
              }
            }
            if (ops > 0) await p.exec();
          } catch (e) {
            console.error('[RedisAuthState] pipeline set error:', e);
          }
        }
      }
    },
    saveCreds: () => writeData(sessionKey, creds),

    clearState: async () => {
      try {
        // 1. Delete session creds
        await redis.del(sessionKey);

        // 2. Delete ALL signal keys using SCAN (keys are keysPrefix + category-id)
        //    Pattern: whatsapp_keys:userId:*
        const deleted = await scanAndDelete(`whatsapp_keys:${userId}:*`);

        // 3. Reset in-memory creds so next makeWASocket gets fresh unregistered state
        Object.assign(creds, initAuthCreds());

        console.log(`[RedisAuthState] Cleared session + ${deleted} signal keys for ${userId}`);
      } catch (err) {
        console.error('[RedisAuthState] clearState error:', err);
      }
    }
  };
};
