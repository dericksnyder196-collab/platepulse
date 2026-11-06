# 0005: Four dashboards, role names and the approval policy

Date: 2026-11-03
Status: Accepted

## Context

PlatePulse has four dashboards: Owner (the platform owner), Admin (a restaurant's admin), Foodie
(customers) and Rider. Blueprint v3.0 had a single "Platform_Admin" and a "Tenant_Owner", which no
longer match how the product is described. The owner is a single person today, so rules that assume
two people ("second approver") need a fallback.

## Decision

1. **Roles.** Platform_Owner, Platform_Finance, Platform_Support and Platform_Ops on the platform
   side. Restaurant_Admin, Shift_Manager and Line_Cook on the restaurant side. Foodie and Rider for
   everyone else. Platform_Admin becomes Platform_Owner, and Tenant_Owner becomes Restaurant_Admin.
   Only Platform_Owner exists at launch, and it can only be created from the terminal.
2. **Permissions.** `domain:action` names, unique within a scope (platform or restaurant). The full
   catalog, with a control level for each, is in `docs/access-model.md`.
3. **Control levels.** L1 routine, L2 reversible (reason and audit), L3 high impact (fresh MFA and
   a reason). Actions marked with a star also follow the approval policy.
4. **Approval policy.** Stopping is immediate, and starting, spending and destroying are approved.
   With a second approver, the approver must differ from the requester. With none, the action waits
   through a cooling-off period (1 hour, or 24 hours for deleting personal data) with a cancel link
   sent to a second channel.
5. **Addresses.** Owner at `/owner` and Admin at `/admin` locally, moving to `owner.<domain>` and
   `admin.<domain>` in production so each has its own cookies and a stricter CSP. Foodie at `/` and
   Rider at `/rider`.

## Consequences

- Every route must declare its scope and permission. A startup test fails if a route uses a
  permission that is not in the catalog, and another fails if a route declares none.
- The Admin, Foodie and Rider plans must follow the role-boundary table in `docs/access-model.md`.
- The thresholds (refunds above 50,000 RWF, campaigns above 1,000 recipients) are proposals to be
  confirmed. They live in configuration, not in code.
- When a second approver is added, the cooling-off delay is replaced by their approval for the
  actions it covers.
