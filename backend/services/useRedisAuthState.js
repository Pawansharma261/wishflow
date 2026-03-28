const { proto, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const redisClient = require('../lib/redis');

const useRedisAuthState = async (userId) => {
  const KEY_PREFIX = `wa_session:${userId}:`;

  const read = async (key) => {
    const data = await redisClient.get(`${KEY_PREFIX}${key}`);
    if (data === null || data === undefined) return null;
    try {
      const raw = typeof data === 'string' ? data : JSON.stringify(data);
      return JSON.parse(raw, (k, v) => {
        if (v && typeof v === 'object' && v.type === 'Buffer' && Array.isArray(v.data)) {
          return Buffer.from(v.data);
        }
        return BufferJSON.reviver(k, v);
      });
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
