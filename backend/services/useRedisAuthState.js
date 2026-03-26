const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { Redis } = require('@upstash/redis');

/**
 * useRedisAuthState - Optimized version with credsStore wrapper.
 * Resolves the stale 'creds' reference bug by using a getter.
 */
const useRedisAuthState = async (userId) => {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('UPSTASH_REDIS_REST_URL/TOKEN is missing.');
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
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      return JSON.parse(str, BufferJSON.reviver);
    } catch (e) { return null; }
  };

  const writeData = async (key, data) => {
    try {
      const str = JSON.stringify(data, BufferJSON.replacer);
      await redis.set(key, str, { ex: 2592000 });
    } catch (e) {}
  };

  const scanAndDelete = async (pattern) => {
    let cursor = 0;
    try {
      do {
        const result = await redis.scan(cursor, { match: pattern, count: 100 });
        const nextCursor = Array.isArray(result) ? result[0] : (result.cursor || 0);
        const keys = Array.isArray(result) ? result[1] : (result.keys || []);
        cursor = Number(nextCursor);
        if (keys && keys.length > 0) await redis.del(...keys);
      } while (cursor !== 0);
    } catch (e) {}
  };

  const loadedCreds = await readData(sessionKey);
  // FIX: Store creds in a value wrapper to prevent stale object references
  const credsStore = { value: loadedCreds || initAuthCreds() };

  return {
    state: {
      // FIX: Use getter so callers always see the current credsStore.value
      get creds() { return credsStore.value; },
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
          } catch (e) {}
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
                if (value) p.set(key, JSON.stringify(value, BufferJSON.replacer), { ex: 2592000 });
                else p.del(key);
                ops++;
              }
            }
            if (ops > 0) await p.exec();
          } catch (e) {}
        },
      },
    },
    // FIX: saveCreds writes the CURRENT value from the store
    saveCreds: () => writeData(sessionKey, credsStore.value),
    clearState: async () => {
      try {
        await redis.del(sessionKey);
        await scanAndDelete(`${keysPrefix}*`);
        // FIX: Replace the object entirely so the state getter returns a fresh one
        credsStore.value = initAuthCreds();
      } catch (e) {}
    },
  };
};

module.exports = useRedisAuthState;
