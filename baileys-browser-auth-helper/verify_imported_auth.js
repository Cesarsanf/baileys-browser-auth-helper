import path from 'node:path'
import pino from 'pino'

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'

function parseArgs(argv) {
  const options = {
    authDir: './baileys_auth_imported',
    timeoutMs: 120_000,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--auth' && next) {
      options.authDir = next
      index += 1
    } else if (arg === '--timeout' && next) {
      const seconds = Number(next)
      if (!Number.isFinite(seconds) || seconds <= 0) {
        throw new Error(`Invalid timeout: ${next}`)
      }
      options.timeoutMs = seconds * 1000
      index += 1
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`)
    }
  }

  return options
}

function printHelp() {
  console.log(`
Verify imported Baileys auth

Usage:
  node verify_imported_auth.js [options]

Options:
  --auth <dir>            Auth directory (default: ./baileys_auth_imported)
  --timeout <seconds>     Overall timeout (default: 120)
  -h, --help              Show this help
`)
}

function getStatus(error) {
  return (
    error?.output?.statusCode ??
    error?.statusCode ??
    error?.status ??
    error?.code
  )
}

function hasCompleteAuthMaterial(creds) {
  return Boolean(
    creds &&
    (creds?.me?.id || creds?.me?.user || creds?.me?.lid) &&
    creds?.noiseKey?.private &&
    creds?.noiseKey?.public &&
    creds?.signedIdentityKey?.private &&
    creds?.signedIdentityKey?.public &&
    creds?.signedPreKey?.keyPair?.private &&
    creds?.signedPreKey?.keyPair?.public &&
    typeof creds?.advSecretKey === 'string' &&
    creds.advSecretKey.length > 0
  )
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const authDir = path.resolve(options.authDir)
  const logger = pino({ level: process.env.LOG_LEVEL || 'warn' })

  let attempts = 0
  let finished = false
  let activeSocket

  const finish = async (code) => {
    if (finished) return
    finished = true

    try { activeSocket?.ev?.removeAllListeners() } catch {}
    try { activeSocket?.ws?.close() } catch {}

    process.exitCode = code
  }

  const timer = setTimeout(async () => {
    console.error(`Verification timed out after ${options.timeoutMs / 1000} seconds.`)
    await finish(1)
  }, options.timeoutMs)

  const connect = async () => {
    attempts += 1
    if (attempts > 3) {
      console.error('Restart limit reached.')
      clearTimeout(timer)
      await finish(1)
      return
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir)

    const summary = {
      completeAuthMaterial: hasCompleteAuthMaterial(state.creds),
      registered: state.creds?.registered === true,
      platform: state.creds?.platform || null,
      hasMe: Boolean(
        state.creds?.me?.id || state.creds?.me?.user || state.creds?.me?.lid
      ),
    }

    console.log('Loaded imported auth:', summary)

    if (!summary.completeAuthMaterial) {
      throw new Error('The auth directory does not contain complete auth material.')
    }

    const sock = makeWASocket({
      auth: state,
      logger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      getUrlInfo: async () => undefined,
    })

    activeSocket = sock

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        console.error(
          'The socket requested a new QR. The imported auth was not accepted as a reusable session.'
        )
        clearTimeout(timer)
        await finish(1)
        return
      }

      if (connection === 'open') {
        console.log('✅ Imported auth is usable: connection=open')
        await sleep(1_500)
        clearTimeout(timer)
        await finish(0)
        return
      }

      if (connection === 'close') {
        const status = getStatus(lastDisconnect?.error)
        const message =
          lastDisconnect?.error?.message || String(lastDisconnect?.error || '')

        console.error('Connection closed:', { status, message })

        try { sock.ev.removeAllListeners() } catch {}
        try { sock.ws?.close() } catch {}

        if (
          status === 515 ||
          status === DisconnectReason.restartRequired
        ) {
          console.log('WhatsApp requested a socket restart. Retrying...')
          await sleep(750)
          await connect()
          return
        }

        if (Number(status) === 428) {
          console.error(
            'Status 428 may indicate the more aggressive passkey rollout where a valid imported session is still rejected on reconnect.'
          )
        }

        clearTimeout(timer)
        await finish(1)
      }
    })
  }

  await connect()
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error)
  process.exitCode = 1
})
