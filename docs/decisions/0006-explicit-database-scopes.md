# 0006: Explicit database scopes (fail closed)

Date: 2026-11-03
Status: Accepted

## Context

Blueprint v3.0 had the database layer silently add a tenant filter, and skip it when no tenant was
known. That fails open: one forgotten middleware or a `null` tenant would let a query read every
restaurant's data. Models also received the whole request object, which breaks the MVC rules.

## Decision

Every query run through `DatabaseController.query(sql, params, scope)` must declare a scope. There
is no default, and a missing or look-alike scope throws.

- `Scope.tenant(id)`: tenant-owned tables, limited to one restaurant. The SQL must contain a
  `{tenant}` marker (or `{tenant:alias}` in joins), which becomes `tenant_id = ?` with the id bound
  at the right position.
- `Scope.PLATFORM`: tenant-owned tables across all restaurants, for platform (owner) code only. A lint
  rule allows it only under `private/platform/`.
- `Scope.GLOBAL`: tables that are not tenant-owned (users, tenants, roles, audit_events). The SQL must
  not contain a marker.

Scope objects can only be created by `private/core/scope.js`, so a plain object from request data
is rejected. Models receive a scope value, never the request.

## Consequences

- A bug can no longer widen a query silently. It throws instead.
- Every model method on a tenant-owned table takes a `scope` argument.
- Limit: the placeholder counter treats every `?` as a parameter, so scoped queries must not contain
  a literal question mark inside a quoted string.
- Still required (Build Guide Step 4): a test that fails the build if a query on a tenant-owned
  table lacks the marker, and cross-tenant integration tests.
