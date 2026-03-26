const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { Redis } = require('@upstash/redis');

const getRedis = () =>
  new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

/**
 * STEP 1 — Call this BEFORE useRedisAuthState().
 * Wipes all session + signal keys for this user from Redis so that
 * the subsequent useRedisAuthState() call builds a genuinely fresh
 * creds object that Baileys has never seen before.
 */
const clearWhatsAppState = async (userId) => {
  const redis = getRedis();
  const sessionKey = `whatsapp_session:${userId}`;
  const keysPrefix = `whatsapp_keys:${userId}:`;

  try {
    await redis.del(sessionKey);
    // Use KEYS + DEL for exhaustive cleanup on Upstash
    const allKeys = await redis.keys(`${keysPrefix}*`);
    if (allKeys.length > 0) await redis.del(...allKeys);
    console.log(`[Redis:wipe] Cleaned state for ${userId}`);
  } catch (e) {
    console.error(`[Redis:wipe] Failed:`, e.message);
  }
};

/**
 * STEP 2 — Call this AFTER clearWhatsAppState().
 * Reads (now-empty) Redis and initialises a fresh creds object.
 */
const useRedisAuthState = async (userId) => {
  const redis = getRedis();
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

  // After clearWhatsAppState() this always resolves to null → initAuthCreds()
  let creds = (await readData(sessionKey)) || initAuthCreds();

  const saveCreds = () => writeData(sessionKey, creds);

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          const allRedisKeys = ids.map((id) => `${keysPrefix}${type}-${id}`);
          try {
            const values = await redis.mget(...allRedisKeys);
            ids.forEach((id, idx) => {
              if (values[idx]) {
                const str = typeof values[idx] === 'string' ? values[idx] : JSON.stringify(values[idx]);
                data[id] = JSON.parse(str, BufferJSON.reviver);
              }
            });
          } catch (e) {}
          return data;
        },
        set: async (data) => {
          try {
            const p = redis.pipeline();
            for (const category in data) {
              for (const id in data[category]) {
                const value = data[category][id];
                const key = `${keysPrefix}${category}-${id}`;
                if (value) p.set(key, JSON.stringify(value, BufferJSON.replacer), { ex: 2592000 });
                else p.del(key);
              }
            }
            await p.exec();
          } catch (e) {}
        },
      },
    },
    saveCreds,
  };
};

module.exports = { useRedisAuthState, clearWhatsAppState };
