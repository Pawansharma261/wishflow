const { proto, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const redisClient = require('../lib/redis');

const useRedisAuthState = async (userId) => {
  const KEY_PREFIX = `wa_session:${userId}:`;

  const read = async (key) => {
    // Upstash REST handles string conversion differently, so we ensure standard reviver
    const data = await redisClient.get(`${KEY_PREFIX}${key}`);
    if (!data) return null;
    try {
      // Upstash sometimes returns already-parsed objects or raw strings
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      return JSON.parse(payload, BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const write = async (key, value) => {
    if (value === null || value === undefined) {
      await redisClient.del(`${KEY_PREFIX}${key}`);
    } else {
      await redisClient.set(
        `${KEY_PREFIX}${key}`,
        JSON.stringify(value, BufferJSON.replacer)
      );
    }
  };

  const creds = (await read('creds')) || initAuthCreds();

  const state = {
    creds,
    keys: {
      get: async (type, ids) => {
        const data = {};
        await Promise.all(
          ids.map(async (id) => {
            let value = await read(`${type}-${id}`);
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
        for (const type in data) {
          for (const id in data[type]) {
            tasks.push(write(`${type}-${id}`, data[type][id]));
          }
        }
        await Promise.all(tasks);
      },
    },
  };

  return {
    state,
    saveCreds: async () => {
      await write('creds', state.creds);
    },
  };
};

const clearWhatsAppState = async (userId) => {
  // Upstash SCAN/KEYS handling
  try {
    const keys = await redisClient.keys(`wa_session:${userId}:*`);
    if (keys && keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch (e) {
    console.warn('[Redis] Flush failed:', e.message);
  }
};

module.exports = { useRedisAuthState, clearWhatsAppState };
