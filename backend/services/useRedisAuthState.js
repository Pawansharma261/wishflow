const { BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');
const redis = require('../lib/redis');

/**
 * useRedisAuthState - A binary-safe Redis auth state provider for Baileys.
 * Uses BufferJSON to ensure cryptographic keys are not corrupted during storage.
 */
const useRedisAuthState = async (userId) => {
  const sessionKey = `whatsapp_session:${userId}`;
  const keysPrefix = `whatsapp_keys:${userId}:`;

  const readData = async (key) => {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data, BufferJSON.reviver);
    } catch (err) {
      console.error(`[Redis] Error reading key ${key}:`, err);
      return null;
    }
  };

  const writeData = async (data, key) => {
    try {
      const json = JSON.stringify(data, BufferJSON.replacer);
      await redis.set(key, json);
    } catch (err) {
      console.error(`[Redis] Error writing key ${key}:`, err);
    }
  };

  const scanAndDelete = async (pattern) => {
    let cursor = '0';
    let totalDeleted = 0;
    do {
      const [_cursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = _cursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== '0');
    return totalDeleted;
  };

  // Load existing creds or init new ones
  const loadedCreds = await readData(sessionKey);
  const creds = loadedCreds || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              const value = await readData(`${keysPrefix}${type}-${id}`);
              if (value) data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${keysPrefix}${category}-${id}`;
              if (value) {
                tasks.push(writeData(value, key));
              } else {
                tasks.push(redis.del(key));
              }
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData(creds, sessionKey);
    },
    clearState: async () => {
      try {
        await redis.del(sessionKey);
        await scanAndDelete(`${keysPrefix}*`);
        // Reset local object to fresh state
        Object.assign(creds, initAuthCreds());
      } catch (err) {
        console.error(`[Redis] Failed to clear state for ${userId}:`, err);
      }
    },
  };
};

module.exports = useRedisAuthState;
