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
        // If the data is an object, stringify and then parse with BufferJSON
        const str = typeof data === 'string' ? data : JSON.stringify(data);
        return JSON.parse(str, BufferJSON.reviver);
      }
      return null;
    } catch (err) {
      console.error('[RedisAuthState] Error reading data', err);
      return null;
    }
  };

  // Helper to write data to Redis
  const writeData = async (key, data) => {
    try {
      const str = JSON.stringify(data, BufferJSON.replacer);
      // Store with 30 days expiration (30 * 24 * 60 * 60 seconds = 2592000)
      await redis.set(key, str, { ex: 2592000 });
    } catch (err) {
      console.error('[RedisAuthState] Error writing data', err);
    }
  };

  const removeData = async (key) => {
    try {
      await redis.del(key);
    } catch (err) {
      console.error('[RedisAuthState] Error removing data', err);
    }
  };

  // Fetch initial state
  let creds = await readData(sessionKey);
  if (!creds) {
    creds = initAuthCreds();
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${keysKey}:${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value);
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
              const key = `${keysKey}:${category}-${id}`;
              if (value) {
                tasks.push(writeData(key, value));
              } else {
                tasks.push(removeData(key));
              }
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: () => {
      return writeData(sessionKey, creds);
    },
    clearState: async () => {
      // Find all keys starting with whatsapp_keys:userId and delete them
      // In Upstash REST, SCAN or pattern deletion is limited, so we rely on TTL
      // But we can easily clear the main session key
      await removeData(sessionKey);
      console.log(`[RedisAuthState] Cleared session for user ${userId}`);
    }
  };
};
