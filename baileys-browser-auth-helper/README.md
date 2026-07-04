# Baileys Browser Auth Helper

A small community helper for accounts that can complete the official WhatsApp Web passkey/WebAuthn flow but cannot finish a fresh QR or pairing-code link directly in Baileys.

This helper uses the browser-auth bridge proposed in WhiskeySockets/Baileys PR #2676. It does **not** bypass the passkey. The user completes the official WhatsApp Web authentication manually, and the helper exports that authenticated browser session into Baileys multi-file auth.

Related threads:

- Issue: https://github.com/WhiskeySockets/Baileys/issues/2672
- Draft PR: https://github.com/WhiskeySockets/Baileys/pull/2676

## Important status

PR #2676 is still a draft and its API may change. This repository is a test helper, not an official Baileys tool.

It has worked for accounts where:

1. WhatsApp Web completes the passkey flow successfully.
2. The resulting linked-device session can be reused by Baileys.

It may not work for accounts that receive status `428` on every reconnect even after a valid browser import.

## Security warning

The following directories contain live WhatsApp session credentials:

- `baileys_auth_imported/`
- `wa_web_bridge_profile/`

Never upload, commit, email, paste, or share them. They are already included in `.gitignore`.

If either directory is exposed, revoke the linked device from WhatsApp immediately.

Use this only with an account you own or are explicitly authorized to manage.

## Requirements

- Node.js 20 or newer
- Chrome, Microsoft Edge, or Chromium
- A phone/account able to complete the official WhatsApp Web passkey flow

The helper searches common browser locations on Windows, macOS, and Linux. You can also provide the executable path explicitly.

## Install

```bash
npm install
```

The Baileys dependency points to the PR branch:

```text
gobeyondpty/Baileys#codex/browser-auth-bridge
```

## Import the browser session

```bash
npm run import
```

The helper will:

1. Start Chrome/Edge/Chromium with a dedicated profile.
2. Open the official WhatsApp Web page.
3. Wait for you to complete QR and passkey confirmation manually.
4. Detect the authenticated browser session.
5. Call `extractWhatsAppWebAuthFromBrowser`.
6. Write `baileys_auth_imported/` with `writeBrowserAuthToMultiFile`.
7. Print only a sanitized summary. It never prints keys or account identifiers.

Custom paths:

```bash
node import_web_auth.js \
  --browser "/path/to/chrome" \
  --output "./baileys_auth_imported" \
  --profile "./wa_web_bridge_profile"
```

On Windows CMD:

```cmd
node import_web_auth.js --browser "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

Delete the dedicated browser profile automatically after a successful import:

```bash
node import_web_auth.js --delete-profile
```

Keeping the profile can help with retries, but it also keeps sensitive browser session material.

## Verify the imported auth

```bash
npm run verify
```

Success:

```text
✅ Imported auth is usable: connection=open
```

The verifier aborts if Baileys requests a new QR. It retries the expected `515/restartRequired` transition up to three times.

Custom auth directory:

```bash
node verify_imported_auth.js --auth ./my_imported_auth
```

## Integrate with an existing bot

Stop the bot first. Back up the current auth directory, then replace or point your application to the imported directory.

Do not run the browser session and Baileys concurrently for normal operation after the import is complete.

### Do not reject imported auth only because `registered` is false

A browser-imported session can contain complete identity, Noise, signed pre-key, and ADV material while `creds.registered` remains `false`.

Applications that perform their own pre-start validation should validate the auth structure instead of requiring only `registered === true`:

```js
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
```

Do **not** manually change `registered` to `true` in `creds.json`.

## Troubleshooting

### Browser not found

Set `CHROME_PATH`:

```bash
CHROME_PATH="/path/to/chrome" npm run import
```

Or use:

```bash
node import_web_auth.js --browser "/path/to/chrome"
```

### Output directory already exists

The helper never overwrites existing auth. Rename or remove the old output directory after backing it up.

### `registered: false`

This alone does not mean the import failed. Run the verifier. The relevant result is whether the auth is structurally complete and Baileys reaches `connection=open`.

### Status 428

Some accounts appear to require additional passkey validation on every connection. In that rollout mode, extraction can succeed while Baileys is still rejected with `428`. This helper does not claim to solve that separate behavior.

### WhatsApp Web is authenticated but extraction fails

The PR is experimental and WhatsApp Web storage can change. Report the WhatsApp Web version, operating system, Node.js version, browser, sanitized error, and PR commit/branch. Never attach browser storage or auth files.

## Responsible reporting

A useful report includes:

- operating system
- Node.js version
- browser and version
- WhatsApp Web version
- Baileys branch or commit
- whether the account required passkey confirmation
- sanitized connection result/status

Never include:

- `creds.json`
- browser profile
- phone number/JID/LID
- Noise keys
- identity keys
- pre-keys
- ADV secret
- localStorage or IndexedDB dumps containing credentials

## License

MIT. See `LICENSE`.
