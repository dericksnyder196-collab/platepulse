# 0002: HS256 access tokens until a second service verifies tokens

Date: 2026-11-03
Status: Accepted

## Context

Blueprint v3.0 required RS256 (asymmetric) signing. RS256 matters when a service that must verify
tokens should not be able to create them. Today a single service both issues and verifies tokens.

## Decision

Use HS256 with a secret of at least 32 characters (enforced at startup in production), a pinned
algorithm, and a 15-minute lifetime. A `kid` header is added in Step 3 so the secret can be rotated.

## Consequences

- Simpler key handling now, with no loss of security for a single verifying service.
- Revisit when a second service (for example a separate admin or realtime service) needs to verify
  tokens: switch to RS256 and publish only the public key.
