const { initAuthCreds } = require('@whiskeysockets/baileys');
const redis = require('../lib/redis');

const replacer = (key, value) => {
  if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
    return { type: 'Buffer', data: Buffer.from(value.data).toString('base64') };
  }
  if (value instanceof Buffer) {
    return { type: 'Buffer', data: value.toString('base64') };
  }
  return value;
};

const reviver = (key, value) => {
  if (value && value.type === 'Buffer') {
    return Buffer.from(value.data, 'base64');
  }
  return value;
};

const useRedisAuthState = async (userId) => {
  const sessionKey = `whatsapp_session:${userId}`;
  const keysPrefix = `whatsapp_keys:${userId}:`;

  const readData = async (key) => {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      const raw = typeof data === 'string' ? data : JSON.stringify(data);
      return JSON.parse(raw, reviver);
    } catch (e) { return null; }
  };

  const writeData = async (key, data) => {
    try {
      const json = JSON.stringify(data, replacer);
      await redis.set(key, json);
    } catch (e) {}
  };

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
              if (value) tasks.push(writeData(key, value));
              else tasks.push(redis.del(key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData(sessionKey, creds);
    },
    clearState: async () => {
      try {
        await redis.del(sessionKey);
        const allKeys = await redis.keys(`${keysPrefix}*`);
        if (allKeys && allKeys.length > 0) {
          await redis.del(...allKeys);
        }
        Object.assign(creds, initAuthCreds());
      } catch (e) {}
    },
  };
};

module.exports = useRedisAuthState;
