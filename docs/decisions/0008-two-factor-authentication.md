# 0008: Two-factor authentication design

Date: 2026-11-09
Status: Accepted

## Context

The owner (and later every platform and restaurant admin account) needs sign-in that survives a
stolen password. The Build Guide requires authenticator-app codes, recovery codes, lockout, replay
protection and a step-up check for high-impact actions.

## Decision

- **Codes:** standard time-based one-time passwords (RFC 6238: SHA-1, 6 digits, 30 seconds), written
  with Node's built-in `crypto` instead of a library, so there is no third-party code in the sign-in
  path. SHA-1 is what every authenticator app expects, and it is safe in this construction (HMAC).
  The implementation is checked against the RFC's published test vectors (`npm run check:crypto`).
- **Stored secret:** AES-256-GCM, with the key in the environment (`MFA_ENCRYPTION_KEY`), never in the
  database. Each value is bound to its account through additional authenticated data, so a ciphertext
  copied to another account does not decrypt. A stolen database dump alone cannot reveal secrets.
- **Recovery codes:** ten single-use codes (50 bits each), stored only as keyed HMAC-SHA256 hashes.
- **Sign-in:** a correct password on an account with two-factor returns a five-minute ticket, not a
  session. Only ticket plus a valid code gives an access token. Tickets, step-up passes and access
  tokens have different `aud` claims, so none can be used as another.
- **Replay and brute force:** the newest accepted time step is stored and a code from that step or
  earlier is refused (atomic update, so parallel requests cannot both win). Five wrong codes lock the
  account for 15 minutes. Failed attempts also count against a per-IP limiter.
- **Step-up:** `POST /api/auth/mfa/step-up` with a fresh code returns a five-minute pass, sent as
  `X-Step-Up-Token` and enforced by `requireStepUp` on L3 routes.
- **Owner:** created only by `npm run create-owner`, which also enrolls two-factor in the terminal. A
  platform account without two-factor cannot sign in.
- **Break-glass:** `npm run mfa:reset -- <email>`, which needs database access.

## Consequences

- The same code cannot be used twice, so a step-up right after login needs the next code (up to 30
  seconds' wait).
- Lose the phone and the recovery codes, and recovery is the terminal reset script.
- Rotating `MFA_ENCRYPTION_KEY` needs a re-encryption step. Add key versions before doing it.
- Rate-limit counters are in memory (per server instance). Move to Redis before running more than
  one instance.
- Everything is recorded in the audit log: enrollment, success, failure, lockout, recovery-code use,
  step-up and reset.
