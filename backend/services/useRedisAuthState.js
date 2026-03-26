const { initAuthCreds } = require('@whiskeysockets/baileys');
const redis = require('../lib/redis');

/**
 * Binary-safe JSON helpers for crypto Buffers.
 */
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
    const data = await redis.get(key);
    if (!data) return null;
    // If it's already an object (upstash auto-parse), we need to manually revive buffers
    const obj = typeof data === 'string' ? JSON.parse(data, reviver) : JSON.parse(JSON.stringify(data), reviver);
    return obj;
  };

  const writeData = async (key, data) => {
    const json = JSON.stringify(data, replacer);
    await redis.set(key, json);
  };

  const scanAndDelete = async (pattern) => {
    let cursor = '0';
    do {
      const [_cursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = _cursor;
      if (keys && keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
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
      await redis.del(sessionKey);
      await scanAndDelete(`${keysPrefix}*`);
      Object.assign(creds, initAuthCreds());
    },
  };
};

module.exports = useRedisAuthState;
