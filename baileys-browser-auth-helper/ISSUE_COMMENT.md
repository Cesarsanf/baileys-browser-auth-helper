A small community helper for testing the browser-auth bridge from #2676 is
available here:

<LINK_TO_REPOSITORY_OR_GIST>

It starts an isolated Chrome/Edge/Chromium profile, lets the user complete the
official WhatsApp Web QR/passkey flow manually, exports the authenticated session
to Baileys multi-file auth, and verifies whether Baileys reaches
`connection=open`.

Tested successfully on an account requiring passkey confirmation.

Important: imported credentials may remain `registered: false` while still being
structurally complete and usable. Custom application validation should not rely on
that field alone.

This is not a universal fix for accounts that continue receiving status 428 after
a valid browser import. Auth output and browser-profile directories contain live
session credentials and must never be shared.
