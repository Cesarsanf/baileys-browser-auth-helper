# Security policy

This helper handles live WhatsApp linked-device credentials.

## Never share

- `baileys_auth_imported/`
- `wa_web_bridge_profile/`
- `creds.json`
- browser localStorage or IndexedDB dumps
- JIDs, LIDs, phone numbers, identity keys, Noise keys, pre-keys, or ADV secrets

## If credentials are exposed

1. Open WhatsApp on the phone.
2. Go to Linked devices.
3. Revoke the affected device/session.
4. Delete the exported auth and dedicated browser profile.
5. Create a new session only after the exposed material is no longer accessible.

## Reports

Only provide sanitized logs. Replace all account identifiers and never attach auth files.
