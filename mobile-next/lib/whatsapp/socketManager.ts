import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import path from 'path'
import fs from 'fs'

const g = global as typeof globalThis & {
  waSockets?: Map<string, any>
  waPairingCodes?: Map<string, string>
  waStatus?: Map<string, 'connecting' | 'connected' | 'disconnected'>
}

if (!g.waSockets)      g.waSockets      = new Map()
if (!g.waPairingCodes) g.waPairingCodes = new Map()
if (!g.waStatus)       g.waStatus       = new Map()

export const sockets      = g.waSockets
export const pairingCodes = g.waPairingCodes
export const waStatus     = g.waStatus

export async function createWhatsAppSocket(userId: string, phoneNumber: string): Promise<string> {
  const phone = phoneNumber.replace(/[^0-9]/g, '')
  if (!phone || phone.length < 10) {
    throw new Error('Invalid phone number. Use digits only with country code. Example: 919876543210')
  }

  if (sockets.has(userId)) {
    try { sockets.get(userId)?.end?.() } catch (_) {}
    sockets.delete(userId)
    pairingCodes.delete(userId)
  }

  const sessionPath = path.join(process.cwd(), '.wa_sessions', userId)
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true })
  }
  fs.mkdirSync(sessionPath, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
  const { version }          = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    printQRInTerminal    : false,
    mobile               : false,
    logger               : pino({ level: 'silent' }),
    browser              : ['WishFlow', 'Chrome', '120.0.0.0'],
    connectTimeoutMs     : 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs  : 10000,
  })

  sockets.set(userId, sock)
  waStatus.set(userId, 'connecting')
  sock.ev.on('creds.update', saveCreds)

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      sock.end?.()
      sockets.delete(userId)
      reject(new Error('Timed out waiting for pairing code. Please try again.'))
    }, 60000)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr !== undefined) {
        try {
          const code      = await sock.requestPairingCode(phone)
          const formatted = code.match(/.{1,4}/g)?.join('-') ?? code
          pairingCodes.set(userId, formatted)
          waStatus.set(userId, 'connecting')
          clearTimeout(timeout)
          resolve(formatted)
        } catch (err: any) {
          clearTimeout(timeout)
          reject(new Error('requestPairingCode failed: ' + (err?.message ?? err)))
        }
      }

      if (connection === 'open') {
        waStatus.set(userId, 'connected')
        pairingCodes.delete(userId)
      }

      if (connection === 'close') {
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode
        waStatus.set(userId, 'disconnected')
        if (code === DisconnectReason.loggedOut) {
          if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true })
          }
          sockets.delete(userId)
          pairingCodes.delete(userId)
        }
      }
    })
  })
}
