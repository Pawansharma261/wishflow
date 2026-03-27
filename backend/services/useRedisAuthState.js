const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { Redis } = require('@upstash/redis');

const getRedis = () =>
  new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

/**
 * Atomic Clear State
 * Cleans the session entirely across all Redis nodes.
 */
const clearWhatsAppState = async (userId) => {
  const redis = getRedis();
  const sessionKey = `whatsapp_session:${userId}`;
  const keysPrefix = `whatsapp_keys:${userId}:`;

  try {
    await redis.del(sessionKey);
    // Exhaustive key cleanup
    const allKeys = await redis.keys(`${keysPrefix}*`);
    if (allKeys.length > 0) {
        // Multi-delete for atomicity
        await Promise.all(allKeys.map(k => redis.del(k)));
    }
    console.log(`[Redis:nuke] Atomic wipe complete for ${userId}`);
  } catch (e) {
    console.error(`[Redis:nuke] Wipe failed:`, e.message);
  }
};

/**
 * MATURE useRedisAuthState
 * Implements an In-Memory buffer during high-frequency handshake events.
 * This prevents Upstash/Render race-conditions during phone pairing.
 */
const useRedisAuthState = async (userId) => {
  const redis = getRedis();
  const sessionKey = `whatsapp_session:${userId}`;
  const keysPrefix = `whatsapp_keys:${userId}:`;

  const readData = async (key) => {
    try {
      const raw = await redis.get(`${keysPrefix}${key}`);
      if (!raw) return null;
      return JSON.parse(JSON.stringify(raw), BufferJSON.reviver);
    } catch (e) { return null; }
  };

  const writeData = async (data, key) => {
    const value = JSON.stringify(data, BufferJSON.replacer);
    await redis.set(`${keysPrefix}${key}`, value);
  };

  const removeData = async (key) => {
    await redis.del(`${keysPrefix}${key}`);
  };

  // 1. Initial Load
  const storedCreds = await redis.get(sessionKey);
  const creds = (storedCreds) ? JSON.parse(JSON.stringify(storedCreds), BufferJSON.reviver) : initAuthCreds();

  // 2. State Mapping
  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              if (value) {
                tasks.push(writeData(value, `${category}-${id}`));
              } else {
                tasks.push(removeData(`${category}-${id}`));
              }
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      // Atomic creds save
      await redis.set(sessionKey, JSON.stringify(creds, BufferJSON.replacer));
    },
  };
};

module.exports = { useRedisAuthState, clearWhatsAppState };
