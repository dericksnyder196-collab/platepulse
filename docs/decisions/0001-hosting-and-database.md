# 0001: Hosting on Render with MySQL on Aiven

Date: 2026-11-03
Status: Accepted

## Context

Blueprint v3.0 assumed self-managed NGINX, PM2, Docker, Redis and replicated MySQL. A small team needs
managed infrastructure it can operate without a dedicated operations person.

## Decision

Run the Express app as a Render web service and use Aiven for managed MySQL, connected over TLS with
the Aiven CA certificate verified. Use Render Key Value (Redis-compatible) from Phase 1.

## Consequences

- Render provides TLS termination, load balancing and restarts, so NGINX and PM2 are not needed.
- The app must stay stateless so more instances can be added.
- The Aiven plan limits total database connections, so pool size per instance must stay small.
- Rate-limit counters need a shared store (Redis) before running more than one instance.
