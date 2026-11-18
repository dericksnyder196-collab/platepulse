# 0009: Owner area isolation and session rules

Date: 2026-11-10
Status: Accepted

## Context

The owner can do things no other account can, so the owner area needs a harder boundary than the
rest of the site, and a session that cannot quietly outlive its welcome.

## Decision

- **Two kinds of session, kept apart both ways.** An access token carries `scope` (`platform` or
  `user`), the platform `roles`, and `amr` (`pwd`, `otp`). Owner routes require a platform session
  that was opened with a one-time code. Restaurant routes require an ordinary session, so an owner
  session is refused there. Use a separate account to test restaurant and ordering flows.
- **Owner routes answer 404, not 403,** to anyone without a platform session, so the area does not
  announce itself. A platform user who lacks one permission gets 403.
- **Permission per route.** `requirePermission('name')` checks the caller's roles against the
  catalog and throws at startup for an unknown name. L3 routes add `requireStepUp`.
- **Session length.** An owner session lasts 30 minutes unless renewed (`OWNER_SESSION_IDLE_MINUTES`).
  The owner page renews it while the person is active, and every renewal re-reads the role from the
  database. A hard limit of 8 hours (`OWNER_SESSION_ABSOLUTE_HOURS`) runs from the original
  sign-in (`auth_time`, carried through renewals), however active the person is.
- **Memory-only token.** The owner page keeps its token in script memory, never in localStorage,
  sessionStorage or a cookie. Reloading or closing the tab ends the session. The ordinary login page
  refuses to store an owner session and points to `/owner/`.
- **Stricter headers** on `/owner` and `/api/v1/owner`: a Content-Security-Policy allowing only this
  site's own files (`default-src 'none'`), no framing, no caching, no referrer, no indexing.
- **Optional network allowlist:** `OWNER_ALLOWED_IPS`. When set, other addresses get a plain 404.

## Consequences

- Owner sessions are stateless tokens, so signing out only discards the token. Revoking one before it
  expires needs a server-side session list, which arrives with refresh tokens (Build Guide, Step 3).
  The 30-minute limit and the role re-check at renewal bound the exposure until then.
- Counters for rate limits are in memory, per server instance.
- The owner page is deliberately small. Restaurants, money and operations arrive in later steps.
- An automated test suite for all of this (every owner route against every kind of token) is step O1d.
