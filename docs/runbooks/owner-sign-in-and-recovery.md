# Owner sign-in and two-factor recovery

## First-time setup

1. Add `MFA_ENCRYPTION_KEY` to `.env` (see `.env.example` for the command). Back it up in a password
   manager.
2. `npm install`, then `npm run migrate` and `npm run seed:rbac`.
3. `npm run create-owner`. It asks for your email and a password (12 or more characters, hidden while
   you type), shows a QR code to scan with an authenticator app, asks for the first code, and then
   prints ten recovery codes. Save the codes in a password manager. They are shown only once.
4. Start the app (`npm start`), and in a second terminal run `npm run owner:check` to prove sign-in
   works.

## Signing in every day

Open `/owner/` (for example `http://localhost:3000/owner/`), enter your email and password, then the
code from your authenticator app. The session lives in that browser tab only: reloading or closing
the tab signs you out. It lasts 30 minutes, renews while you work, and ends after 8 hours at the
latest. If you sign in on the normal login page instead, it points you to `/owner/`.

An owner account cannot be used for restaurants or ordering. Use a separate account to test those.

To limit the owner area to certain networks, set `OWNER_ALLOWED_IPS` (comma-separated). Other
addresses get a plain 404.

## Checking the access rules

- `npm run check:crypto` (one-time-code math and encryption, offline)
- `npm run check:access` (permission catalog and guards, offline)
- `npm run owner:check` (the whole owner sign-in against the running app)

## Forgot the password

There is no web "forgot password" screen yet. From your terminal, set a new one:
`npm run password:set -- you@example.com` (12 or more characters for platform accounts, typed hidden
twice). Two-factor is not affected, so you still need a code to sign in. The change is recorded in
the audit log.

## Lost your phone

Sign in with one of the ten recovery codes in the code box. Each works once. Afterwards, set up a new
phone: there is no web screen for this yet, so run `npm run mfa:reset -- you@example.com` and then
`npm run create-owner` to enroll again.

## Lost your phone and the recovery codes

`npm run mfa:reset -- you@example.com` (needs access to the database from your terminal), then
`npm run create-owner` to enroll again. The reset is recorded in the audit log.

## Locked out after wrong codes

Five wrong codes lock the account for 15 minutes. Wait, then try again. Each attempt, success or
failure, is in the audit log.

## Losing `MFA_ENCRYPTION_KEY`

Stored authenticator secrets cannot be decrypted without it. Nobody can sign in with a code until
each account is reset (`npm run mfa:reset`) and enrolled again. Keep a copy in a password manager.
