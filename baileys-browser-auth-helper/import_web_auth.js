import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import puppeteer from 'puppeteer-core'

import {
  extractWhatsAppWebAuthFromBrowser,
  writeBrowserAuthToMultiFile,
} from '@whiskeysockets/baileys'

const DEFAULT_OUTPUT_DIR = './baileys_auth_imported'
const DEFAULT_PROFILE_DIR = './wa_web_bridge_profile'

function parseArgs(argv) {
  const options = {
    outputDir: DEFAULT_OUTPUT_DIR,
    profileDir: DEFAULT_PROFILE_DIR,
    browserPath: process.env.CHROME_PATH || '',
    deleteProfile: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--output' && next) {
      options.outputDir = next
      index += 1
    } else if (arg === '--profile' && next) {
      options.profileDir = next
      index += 1
    } else if (arg === '--browser' && next) {
      options.browserPath = next
      index += 1
    } else if (arg === '--delete-profile') {
      options.deleteProfile = true
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
Baileys browser-auth helper

Usage:
  node import_web_auth.js [options]

Options:
  --output <dir>          Auth output directory (default: ${DEFAULT_OUTPUT_DIR})
  --profile <dir>         Dedicated browser profile (default: ${DEFAULT_PROFILE_DIR})
  --browser <path>        Chrome/Edge/Chromium executable path
  --delete-profile        Delete the dedicated browser profile after a successful import
  -h, --help              Show this help

Environment:
  CHROME_PATH             Alternative to --browser
`)
}

function browserCandidates() {
  const home = process.env.HOME || process.env.USERPROFILE || ''
  const localAppData = process.env.LOCALAPPDATA || ''

  return [
    process.env.CHROME_PATH,

    // Windows
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    localAppData && path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    localAppData && path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),

    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    home && path.join(home, 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),

    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ].filter(Boolean)
}

function findBrowser(explicitPath) {
  if (explicitPath) {
    const resolved = path.resolve(explicitPath)
    if (!fs.existsSync(resolved)) {
      throw new Error(`Browser executable not found: ${resolved}`)
    }
    return resolved
  }

  return browserCandidates().find((candidate) => fs.existsSync(candidate)) || ''
}

function ensureOutputDoesNotExist(outputDir) {
  if (fs.existsSync(outputDir)) {
    throw new Error(
      `The output directory already exists: ${outputDir}\n` +
      'Rename or remove it before importing again. Existing auth is never overwritten.'
    )
  }
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

function readSanitizedSummary(credsPath) {
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'))

  return {
    completeAuthMaterial: hasCompleteAuthMaterial(creds),
    registered: creds?.registered === true,
    platform: creds?.platform || null,
    hasMe: Boolean(creds?.me?.id || creds?.me?.user || creds?.me?.lid),
    hasNoiseKey: Boolean(creds?.noiseKey?.private && creds?.noiseKey?.public),
    hasIdentityKey: Boolean(
      creds?.signedIdentityKey?.private && creds?.signedIdentityKey?.public
    ),
    hasSignedPreKey: Boolean(
      creds?.signedPreKey?.keyPair?.private &&
      creds?.signedPreKey?.keyPair?.public
    ),
    hasAdvSecretKey: Boolean(creds?.advSecretKey),
  }
}

async function removeDedicatedProfile(profileDir) {
  await fs.promises.rm(profileDir, { recursive: true, force: true })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const outputDir = path.resolve(options.outputDir)
  const profileDir = path.resolve(options.profileDir)
  const executablePath = findBrowser(options.browserPath)

  if (!executablePath) {
    throw new Error(
      'Chrome, Edge, or Chromium was not found. Use --browser <path> or set CHROME_PATH.'
    )
  }

  if (outputDir === profileDir) {
    throw new Error('The auth output and browser profile directories must be different.')
  }

  ensureOutputDoesNotExist(outputDir)

  const terminal = readline.createInterface({ input, output })
  let browser
  let importSucceeded = false

  try {
    console.log('Browser:', executablePath)
    console.log('Dedicated browser profile:', profileDir)
    console.log('Auth output:', outputDir)
    console.log('\nSECURITY: both directories contain sensitive session material.')
    console.log('Never upload, commit, email, or share them.\n')

    browser = await puppeteer.launch({
      executablePath,
      headless: false,
      userDataDir: profileDir,
      defaultViewport: null,
      args: [
        '--start-maximized',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    })

    const pages = await browser.pages()
    const page = pages[0] || await browser.newPage()

    await page.goto('https://web.whatsapp.com', {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    })

    console.log('In the browser:')
    console.log('1. Link the device using the official WhatsApp Web flow.')
    console.log('2. Complete the passkey/WebAuthn confirmation on your own device.')
    console.log('3. Wait until the conversation list is fully visible.')
    console.log('4. Do not log out or remove the linked device.\n')

    await terminal.question(
      'When WhatsApp Web is fully authenticated, press ENTER here...'
    )

    if (!page.url().startsWith('https://web.whatsapp.com')) {
      throw new Error(`The active page is not WhatsApp Web: ${page.url()}`)
    }

    await page.waitForFunction(
      () =>
        Boolean(localStorage.getItem('last-wid-md')) &&
        Boolean(localStorage.getItem('WALid')),
      { timeout: 60_000 }
    )

    console.log('Authenticated browser storage found. Extracting auth material...')

    const extracted = await page.evaluate(extractWhatsAppWebAuthFromBrowser)

    console.log('Writing Baileys multi-file auth...')

    await writeBrowserAuthToMultiFile(outputDir, extracted, {
      name: 'Baileys Browser Import',
      platform: 'web',
    })

    const credsPath = path.join(outputDir, 'creds.json')
    if (!fs.existsSync(credsPath)) {
      throw new Error('The import completed without creating creds.json.')
    }

    const summary = readSanitizedSummary(credsPath)
    if (!summary.completeAuthMaterial) {
      throw new Error(
        'creds.json was created, but the expected auth material is incomplete.'
      )
    }

    importSucceeded = true

    console.log('\nImport completed successfully:')
    console.log(summary)
    console.log('\nAuth directory:', outputDir)
    console.log('Next step: npm run verify')
    console.log(
      '\nNote: imported auth can be structurally complete even when registered is false.'
    )
  } finally {
    terminal.close()

    if (browser) {
      console.log('Closing the dedicated browser...')
      await browser.close().catch(() => {})
    }

    if (importSucceeded && options.deleteProfile) {
      console.log('Deleting the dedicated browser profile...')
      await removeDedicatedProfile(profileDir)
    } else if (importSucceeded) {
      console.log(
        `Dedicated browser profile kept at: ${profileDir}\n` +
        'Delete it after verifying the imported auth if you no longer need it.'
      )
    }
  }
}

main().catch((error) => {
  console.error('\nImport failed:')
  console.error(error?.stack || error?.message || error)
  process.exitCode = 1
})
