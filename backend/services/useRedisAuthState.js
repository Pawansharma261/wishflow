const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { Redis } = require('@upstash/redis');

/**
 * Custom Auth State for Baileys using Upstash Redis
 * Parses and stringifies JSON using Baileys' BufferJSON to handle Buffers properly
 */
module.exports = async function useRedisAuthState(userId) {
  // If no Upstash credentials, we can't connect, so throw early or handle.
  // Actually we should create a Redis client inside if process.env.UPSTASH_REDIS_REST_URL exists
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Upstash Redis credentials are missing in Environment Variables.');
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const sessionKey = `whatsapp_session:${userId}`;
  const keysKey = `whatsapp_keys:${userId}`;

  // Helper to read data from Redis
  const readData = async (key) => {
    try {
      const data = await redis.get(key);
      if (data) {
        const str = typeof data === 'string' ? data : JSON.stringify(data);
        return JSON.parse(str, BufferJSON.reviver);
      }
      return null;
    } catch (err) {
      console.error('[RedisAuthState] Error reading data', err);
      return null;
    }
  };

  const writeData = async (key, data) => {
    try {
      const str = JSON.stringify(data, BufferJSON.replacer);
      await redis.set(key, str, { ex: 2592000 });
    } catch (err) {
      console.error('[RedisAuthState] Error writing data', err);
    }
  };

  let creds = await readData(sessionKey);
  if (!creds) {
    creds = initAuthCreds();
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          if (!ids || ids.length === 0) return {};
          const data = {};
          try {
            const allKeys = ids.map(id => `${keysKey}:${type}-${id}`);
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
                const key = `${keysKey}:${category}-${id}`;
                if (value) {
                  const str = JSON.stringify(value, BufferJSON.replacer);
                  p.set(key, str, { ex: 2592000 });
                } else {
                  p.del(key);
                }
                ops++;
              }
            }
            if (ops > 0) {
              await p.exec();
            }
          } catch (e) {
            console.error('[RedisAuthState] pipeline set error:', e);
          }
        }
      }
    },
    saveCreds: () => {
      return writeData(sessionKey, creds);
    },
    clearState: async () => {
      await redis.del(sessionKey);
      console.log(`[RedisAuthState] Cleared session for user ${userId}`);
    }
  };
};
