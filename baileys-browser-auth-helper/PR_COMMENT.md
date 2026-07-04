Tested and working ✅

I successfully used the browser-auth bridge with an account that required the
WhatsApp Web passkey flow.

Environment:

- Windows
- Chrome / Microsoft Edge
- Node.js 20+
- Baileys branch: `gobeyondpty/Baileys#codex/browser-auth-bridge`

I prepared a small end-to-end community helper that:

1. Finds Chrome/Edge/Chromium or accepts an explicit executable path.
2. Starts an isolated browser profile.
3. Lets the user complete the official QR/passkey flow manually.
4. Waits until WhatsApp Web is fully authenticated.
5. Calls `extractWhatsAppWebAuthFromBrowser`.
6. Writes Baileys multi-file auth with `writeBrowserAuthToMultiFile`.
7. Refuses to overwrite an existing auth directory.
8. Provides a separate verifier that confirms `connection=open` without printing
   keys or account identifiers.

One integration detail: imported credentials may have `registered: false` while
still containing complete identity, Noise, signed pre-key, and ADV material.
Applications with custom pre-start auth validation should not reject the session
solely because of the `registered` field.

Helper and instructions:

<LINK_TO_REPOSITORY_OR_GIST>

Security note: the generated auth directory and dedicated browser profile contain
live session material and must never be committed or shared.

This helper does not claim to solve the separate case where a valid imported
session is rejected with status 428 on every reconnect.
