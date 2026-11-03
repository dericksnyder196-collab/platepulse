# 0003: Multi-page frontend with plain ES modules

Date: 2026-11-03
Status: Accepted

## Context

Most users will be on mid-range phones over mobile data. The strict Content-Security-Policy forbids
inline scripts. The current screens (login, dashboard, menu management, public menu) are mostly
forms and lists.

## Decision

Keep server-served HTML pages with small JavaScript files and a hand-written CSS design system
(see 0004). No client framework for now.

Bundling with Vite (minified, content-hashed files) was planned for Step 1 but is deferred: the
stylesheets and scripts are still small, and adding a build step now would slow each change without
a measurable benefit. Add Vite when total CSS and JS grow past a few tens of kilobytes, or when
long-lived caching of assets matters.

## Consequences

- Small payloads, fast first load, and a simple CSP.
- Heavily interactive screens (kitchen display, rider app) may justify a small library such as Preact.
  Revisit at the start of Phase 2.
- When Vite is added, the Render build command changes to run the build, and Express serves the
  built folder instead of `public/`.
