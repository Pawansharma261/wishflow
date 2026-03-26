const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { Redis } = require('@upstash/redis');

/**
 * useRedisAuthState - Definitive version.
 * Directly initializes Upstash Redis and ensures binary-safe storage of 
 * WhatsApp cryptographic keys using BufferJSON.
 */
const useRedisAuthState = async (userId) => {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('UPSTASH_REDIS_REST_URL/TOKEN is missing in environment.');
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const sessionKey = `whatsapp_session:${userId}`;
  const keysPrefix = `whatsapp_keys:${userId}:`;

  const readData = async (key) => {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      // High-reliability revival of binary Buffers
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      return JSON.parse(str, BufferJSON.reviver);
    } catch (e) {
      console.error(`[Redis] Read failure for ${key}:`, e);
      return null;
    }
  };

  const writeData = async (key, data) => {
    try {
      const str = JSON.stringify(data, BufferJSON.replacer);
      // Set with 30-day expiration (2592000s)
      await redis.set(key, str, { ex: 2592000 });
    } catch (e) {
      console.error(`[Redis] Write failure for ${key}:`, e);
    }
  };

  const scanAndDelete = async (pattern) => {
    let cursor = 0;
    try {
      do {
        const result = await redis.scan(cursor, { match: pattern, count: 100 });
        const nextCursor = Array.isArray(result) ? result[0] : (result.cursor || 0);
        const keys = Array.isArray(result) ? result[1] : (result.keys || []);
        
        cursor = Number(nextCursor);
        if (keys && keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== 0);
    } catch (e) {
      console.error(`[Redis] Scan error:`, e.message);
    }
  };

  const loadedCreds = await readData(sessionKey);
  const creds = loadedCreds || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          if (!ids || ids.length === 0) return {};
          const data = {};
          try {
            const allKeys = ids.map(id => `${keysPrefix}${type}-${id}`);
            const values = await redis.mget(...allKeys);
            ids.forEach((id, idx) => {
              let value = values[idx];
              if (value) {
                const str = typeof value === 'string' ? value : JSON.stringify(value);
                data[id] = JSON.parse(str, BufferJSON.reviver);
              }
            });
          } catch (e) {
            console.error(`[Redis] mget error:`, e);
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
            console.error(`[Redis] Pipeline error:`, e);
          }
        },
      },
    },
    saveCreds: async () => {
      await writeData(sessionKey, creds);
    },
    clearState: async () => {
      try {
        await redis.del(sessionKey);
        await scanAndDelete(`${keysPrefix}*`);
        Object.assign(creds, initAuthCreds());
      } catch (e) {}
    },
  };
};

module.exports = useRedisAuthState;
