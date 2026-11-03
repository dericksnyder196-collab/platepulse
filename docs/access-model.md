# Access model

Status: Draft for sign-off (Step O0). Once signed off, Step O1 turns this into code: a constants
file and database seed, with a startup test that fails if a route uses a permission that is not
listed here.

## 1. The four dashboards

| Dashboard | Who                                           | Scope                  | Address (local, then production) |
| --------- | --------------------------------------------- | ---------------------- | -------------------------------- |
| Owner     | The PlatePulse owner and platform staff       | The whole platform     | `/owner`, then `owner.<domain>`  |
| Admin     | A restaurant's admin, with managers and cooks | One restaurant         | `/admin`, then `admin.<domain>`  |
| Foodie    | Customers                                     | Own account and orders | `/` and `/r/:slug`               |
| Rider     | Delivery riders                               | Own jobs and earnings  | `/rider`                         |

Owner and Admin get their own host in production so each has its own cookies and its own stricter
Content-Security-Policy. The domain is not chosen yet.

## 2. Roles

| Role             | Scope          | Dashboard | Notes                                                                 |
| ---------------- | -------------- | --------- | --------------------------------------------------------------------- |
| Platform_Owner   | Platform       | Owner     | You. Holds every platform permission. Created only from the terminal. |
| Platform_Finance | Platform       | Owner     | Optional. Money views and payout preparation and approval.            |
| Platform_Support | Platform       | Owner     | Optional. People, orders, disputes and tickets. No money movement.    |
| Platform_Ops     | Platform       | Owner     | Optional. Restaurants, riders, zones, settings and system health.     |
| Restaurant_Admin | One restaurant | Admin     | Replaces the Blueprint's Tenant_Owner.                                |
| Shift_Manager    | One restaurant | Admin     | Day-to-day management within limits set by the admin.                 |
| Line_Cook        | One restaurant | Admin     | Kitchen queue only.                                                   |
| Foodie           | Own account    | Foodie    | Every account is a Foodie by default. No membership record needed.    |
| Rider            | Own profile    | Rider     | Has a rider profile, approved by the owner.                           |

At launch only Platform_Owner exists. The other platform roles are defined now so they can be
handed out later without redesign. One person can hold several roles. For testing, your owner
account can also hold a restaurant role and a Foodie identity.

Renames from the Blueprint: Platform_Admin becomes Platform_Owner, Tenant_Owner becomes
Restaurant_Admin, and the sample Tenant_Manager becomes Shift_Manager.

## 3. Control levels and the approval policy

| Level | Meaning                                        | What it needs                                                                     |
| ----- | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| L1    | Routine: view, search, export                  | Logged                                                                            |
| L2    | Reversible change                              | A reason, and an audit entry with before and after values                         |
| L3    | High impact: money, destruction, access, rules | A fresh MFA check (step-up) and a reason, plus the approval policy where marked ★ |

**Stopping is immediate. Starting, spending and destroying are approved.** Freezing payouts, pausing
orders, suspending a restaurant, blocking a user and switching on maintenance mode take effect at
once. Approving money, deleting data, changing rules and changing who has access wait for approval.

**Approval policy (★).**

- With a second approver available: the approver must be a different person from the requester.
- With no second approver (the situation today): the action enters a **cooling-off period**, and a
  notice goes to a second channel (email and phone) with a Cancel link. It runs at the end of the
  period unless cancelled. When a second approver exists, they replace the delay.
- Proposed defaults, for you to confirm: cooling-off of 1 hour, and 24 hours for deleting personal
  data. Refunds need approval above 50,000 RWF. Message campaigns need approval above 1,000
  recipients.

## 4. Platform permission catalog

A permission name is unique within its scope. The same word can appear in the platform scope and the
restaurant scope with a different meaning, so every route declares both its scope and its permission.
Platform-wide versions of order and ledger permissions end in `_any` or `_all`.

Columns: **O** = Platform_Owner, **F** = Platform_Finance, **S** = Platform_Support, **P** = Platform_Ops.
A tick means the role holds the permission.

### Home and search

| Permission      | Allows                                                                                   | Level | O   | F   | S   | P   |
| --------------- | ---------------------------------------------------------------------------------------- | ----- | --- | --- | --- | --- |
| `overview:view` | See Home numbers and the needs-attention queue (each role sees only its own items)       | L1    | ✓   | ✓   | ✓   | ✓   |
| `search:global` | Search restaurants, people and orders (results filtered by the role's other permissions) | L1    | ✓   | ✓   | ✓   | ✓   |

### Restaurants

| Permission                      | Allows                                                                        | Level | O   | F   | S   | P   |
| ------------------------------- | ----------------------------------------------------------------------------- | ----- | --- | --- | --- | --- |
| `restaurant:view`               | List, profile, read-only menu snapshot                                        | L1    | ✓   | ✓   | ✓   | ✓   |
| `restaurant:export`             | Export the restaurant list as CSV                                             | L1    | ✓   | ✓   | –   | ✓   |
| `restaurant:note`               | Internal notes, tags, assigned account manager                                | L1    | ✓   | ✓   | ✓   | ✓   |
| `restaurant:review_application` | Approve, request changes, or reject an application                            | L2    | ✓   | –   | –   | ✓   |
| `restaurant:set_status`         | Put live, suspend, reinstate                                                  | L2    | ✓   | –   | –   | ✓   |
| `restaurant:edit_settings`      | Delivery radius limits, prep-time cap, allowed payment methods, featured flag | L2    | ✓   | –   | –   | ✓   |
| `restaurant:emergency_hide`     | Hide a menu item or menu, pause new orders for one restaurant                 | L2    | ✓   | –   | –   | ✓   |
| `restaurant:bulk_action`        | Bulk message, export or tag                                                   | L2    | ✓   | –   | –   | ✓   |
| `restaurant:terminate`          | Terminate a restaurant permanently                                            | L3★   | ✓   | –   | –   | –   |
| `restaurant:transfer_admin`     | Move a restaurant to a new admin                                              | L3★   | ✓   | –   | –   | –   |

### Restaurant staff accounts

| Permission                    | Allows                                                    | Level | O   | F   | S   | P   |
| ----------------------------- | --------------------------------------------------------- | ----- | --- | --- | --- | --- |
| `staff_account:view`          | See a restaurant's staff, roles, last login, MFA status   | L1    | ✓   | –   | ✓   | ✓   |
| `staff_account:force_signout` | Force sign-out, require a password reset, lock an account | L2    | ✓   | –   | ✓   | –   |

### Riders

| Permission                 | Allows                                                  | Level | O   | F   | S   | P   |
| -------------------------- | ------------------------------------------------------- | ----- | --- | --- | --- | --- |
| `rider:view`               | List, profile, performance                              | L1    | ✓   | ✓   | ✓   | ✓   |
| `rider:view_live_map`      | Live map of online riders and active deliveries         | L1    | ✓   | –   | ✓   | ✓   |
| `rider:review_application` | Review documents, approve, reject, ask for resubmission | L2    | ✓   | –   | –   | ✓   |
| `rider:set_status`         | Suspend and reinstate                                   | L2    | ✓   | –   | –   | ✓   |
| `rider:manage_zones`       | Zones and shifts                                        | L2    | ✓   | –   | –   | ✓   |
| `rider:warn`               | Performance warnings, rating review                     | L2    | ✓   | –   | –   | ✓   |
| `rider:deactivate`         | Deactivate permanently                                  | L3    | ✓   | –   | –   | –   |
| `rider:settle_cash`        | Settle cash-on-delivery balances                        | L3★   | ✓   | ✓   | –   | –   |

### Customers

| Permission                   | Allows                                                              | Level | O   | F   | S   | P   |
| ---------------------------- | ------------------------------------------------------------------- | ----- | --- | --- | --- | --- |
| `customer:view`              | Masked profile, order, refund and complaint history                 | L1    | ✓   | ✓   | ✓   | ✓   |
| `customer:reveal_contact`    | Reveal a masked phone or email, with a reason                       | L2    | ✓   | –   | ✓   | –   |
| `customer:block`             | Block, unblock, or limit (for example, switch off cash on delivery) | L2    | ✓   | –   | ✓   | –   |
| `customer:review_fraud_flag` | Review and clear fraud flags                                        | L2    | ✓   | –   | ✓   | –   |
| `data_request:view`          | See data export and deletion requests                               | L1    | ✓   | –   | ✓   | –   |
| `data_request:complete`      | Complete a deletion or export request                               | L3★   | ✓   | –   | –   | –   |

### Orders and operations

| Permission              | Allows                                                          | Level | O   | F   | S   | P   |
| ----------------------- | --------------------------------------------------------------- | ----- | --- | --- | --- | --- |
| `order:view_any`        | Orders explorer, live board, order timeline                     | L1    | ✓   | ✓   | ✓   | ✓   |
| `order:intervene`       | Cancel, reassign a rider, resend a notification, mark failed    | L2    | ✓   | –   | ✓   | ✓   |
| `order:refund_request`  | Propose a refund for approval                                   | L2    | ✓   | –   | ✓   | ✓   |
| `order:refund_any`      | Issue a full or partial refund                                  | L3★   | ✓   | ✓   | –   | –   |
| `dispute:view`          | See the dispute queue and evidence                              | L1    | ✓   | ✓   | ✓   | ✓   |
| `dispute:resolve`       | Record a decision (money moves only through `order:refund_any`) | L2    | ✓   | –   | ✓   | –   |
| `platform:pause_orders` | Pause new orders platform-wide or in one zone                   | L3    | ✓   | –   | –   | –   |

### Money

| Permission               | Allows                                                                          | Level | O   | F   | S   | P   |
| ------------------------ | ------------------------------------------------------------------------------- | ----- | --- | --- | --- | --- |
| `ledger:view_all`        | Read-only ledger across all restaurants                                         | L1    | ✓   | ✓   | –   | –   |
| `ledger:export`          | Export ledger entries (capped and logged)                                       | L1    | ✓   | ✓   | –   | –   |
| `ledger:integrity_view`  | Hash-chain verification status and daily checkpoints                            | L1    | ✓   | ✓   | –   | ✓   |
| `payout:view`            | See payouts and statements                                                      | L1    | ✓   | ✓   | –   | –   |
| `reconciliation:view`    | Provider statements against the ledger                                          | L1    | ✓   | ✓   | –   | –   |
| `financial_report:view`  | Revenue, commission, payouts, taxes, cash on delivery                           | L1    | ✓   | ✓   | –   | –   |
| `payout:prepare`         | Generate a payout batch for review                                              | L2    | ✓   | ✓   | –   | –   |
| `promo_budget:manage`    | Track and adjust platform-funded promotion budgets                              | L2    | ✓   | ✓   | –   | –   |
| `payout:approve`         | Approve a batch (approver differs from the preparer)                            | L3★   | ✓   | ✓   | –   | –   |
| `payout:hold`            | Hold a single payout                                                            | L3    | ✓   | ✓   | –   | –   |
| `payout:freeze`          | Freeze all payouts at once                                                      | L3    | ✓   | –   | –   | –   |
| `chargeback:handle`      | Handle chargebacks                                                              | L3★   | ✓   | ✓   | –   | –   |
| `reconciliation:resolve` | Resolve a reconciliation difference                                             | L3★   | ✓   | ✓   | –   | –   |
| `commission:manage`      | Default, per-restaurant and per-category commission rules, with effective dates | L3★   | ✓   | –   | –   | –   |
| `delivery_fee:manage`    | Delivery fee rules by zone                                                      | L3★   | ✓   | –   | –   | –   |
| `tax:manage`             | Tax rules                                                                       | L3★   | ✓   | –   | –   | –   |

### Marketing and content

| Permission              | Allows                                                            | Level | O   | F   | S   | P   |
| ----------------------- | ----------------------------------------------------------------- | ----- | --- | --- | --- | --- |
| `taxonomy:manage`       | Cuisines, dietary and allergen tags, categories                   | L2    | ✓   | –   | –   | ✓   |
| `content:manage`        | Home banners, featured restaurants, collections                   | L2    | ✓   | –   | –   | ✓   |
| `campaign:manage`       | Platform promo codes and campaigns with budget caps               | L2    | ✓   | –   | –   | ✓   |
| `message_campaign:send` | Push, SMS and email campaigns (approval above the audience limit) | L2★   | ✓   | –   | –   | ✓   |
| `review:moderate`       | Hide and restore reviews                                          | L2    | ✓   | –   | ✓   | –   |
| `legal:manage`          | Terms and privacy policy versions, forced re-consent              | L3★   | ✓   | –   | –   | –   |

### Platform settings and feature flags

| Permission              | Allows                                                                                                    | Level | O   | F   | S   | P   |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | ----- | --- | --- | --- | --- |
| `zone:manage`           | Service areas drawn as zones                                                                              | L2    | ✓   | –   | –   | ✓   |
| `settings:edit`         | Opening hours, delivery radius, minimum orders, languages, currencies, notification templates, sender IDs | L2    | ✓   | –   | –   | ✓   |
| `flag:manage`           | Feature flags with audience, history and rollback                                                         | L2    | ✓   | –   | –   | ✓   |
| `payment_method:toggle` | Turn a payment method on or off, per zone                                                                 | L3    | ✓   | –   | –   | –   |
| `maintenance:toggle`    | Maintenance mode and the app-wide banner                                                                  | L3    | ✓   | –   | –   | –   |

### Support and trust

| Permission            | Allows                                                                  | Level | O   | F   | S   | P   |
| --------------------- | ----------------------------------------------------------------------- | ----- | --- | --- | --- | --- |
| `ticket:view`         | Ticket inbox                                                            | L1    | ✓   | –   | ✓   | ✓   |
| `fraud_signal:view`   | Order velocity, repeated cancellations, GPS anomalies                   | L1    | ✓   | ✓   | ✓   | –   |
| `ticket:handle`       | Assign, reply, close                                                    | L2    | ✓   | –   | ✓   | –   |
| `abuse_report:decide` | Close reports against restaurants, riders and customers with a decision | L2    | ✓   | –   | ✓   | –   |
| `blocklist:manage`    | Block phone numbers and devices                                         | L2    | ✓   | –   | ✓   | –   |

### Team, access and security

| Permission               | Allows                                                       | Level | O   | F   | S   | P   |
| ------------------------ | ------------------------------------------------------------ | ----- | --- | --- | --- | --- |
| `platform_staff:view`    | Role and permission viewer, access review                    | L1    | ✓   | –   | –   | –   |
| `audit:view`             | Search the audit log                                         | L1    | ✓   | –   | –   | –   |
| `audit:export`           | Export audit entries (capped and logged)                     | L1    | ✓   | –   | –   | –   |
| `security:view`          | Security center                                              | L1    | ✓   | –   | –   | ✓   |
| `consent:view`           | Consent and policy acceptance records                        | L1    | ✓   | –   | ✓   | –   |
| `system:view_health`     | Uptime, errors, latency, database connections, jobs, backups | L1    | ✓   | –   | –   | ✓   |
| `analytics:view`         | Cohorts, funnel, leaderboards, demand maps                   | L1    | ✓   | ✓   | –   | ✓   |
| `incident:manage`        | Incident log and status-page message                         | L2    | ✓   | –   | –   | ✓   |
| `analytics:schedule`     | Saved views and scheduled reports                            | L2    | ✓   | ✓   | –   | ✓   |
| `platform_staff:manage`  | Invite platform staff, assign roles, remove access           | L3★   | ✓   | –   | –   | –   |
| `security_policy:manage` | Require MFA, session lengths, IP allowlist                   | L3    | ✓   | –   | –   | –   |
| `approval_rules:manage`  | Which actions need approval and the thresholds               | L3★   | ✓   | –   | –   | –   |

Every platform user can manage their own account (MFA, recovery codes, sessions, alert routing). That
is not a permission, so it is not listed.

## 5. Restaurant-scope permissions (provisional)

These belong to the Admin dashboard and will be finalized in its own plan. They are listed here so the
two scopes do not collide.

| Permission             | Allows                                         | Restaurant_Admin | Shift_Manager | Line_Cook |
| ---------------------- | ---------------------------------------------- | ---------------- | ------------- | --------- |
| `menu:create`          | Create menu items and categories               | ✓                | ✓             | –         |
| `menu:edit`            | Edit items, prices, availability, translations | ✓                | ✓             | –         |
| `order:view`           | See the restaurant's orders                    | ✓                | ✓             | ✓         |
| `order:update_kitchen` | Accept, prepare, mark ready                    | ✓                | ✓             | ✓         |
| `order:update`         | Cancel an order, other status changes          | ✓                | ✓             | –         |
| `order:refund`         | Refund within the limit set by the admin       | ✓                | ✓             | –         |
| `analytics:view`       | Restaurant sales and preparation metrics       | ✓                | ✓             | –         |
| `financials:view`      | Earnings, fees, payouts, statements            | ✓                | –             | –         |
| `storefront:edit`      | Banner, description, hours                     | ✓                | –             | –         |
| `staff:invite`         | Invite staff                                   | ✓                | –             | –         |
| `staff:manage`         | Change roles, remove staff                     | ✓                | –             | –         |

## 6. Role boundaries across the four dashboards

This table is the contract between the dashboards. The Admin, Foodie and Rider plans must agree with it.

| Capability                       | Owner                        | Admin (restaurant)                  | Foodie       | Rider                           |
| -------------------------------- | ---------------------------- | ----------------------------------- | ------------ | ------------------------------- |
| See restaurants                  | All                          | Own restaurant                      | Public menus | Pickup address of assigned jobs |
| Edit a menu                      | No (emergency hide only)     | Yes                                 | No           | No                              |
| Approve or suspend a restaurant  | Yes                          | No                                  | No           | No                              |
| Set commission and delivery fees | Yes                          | No                                  | No           | No                              |
| See the ledger                   | All                          | Own restaurant                      | Own receipts | Own earnings                    |
| Place an order                   | No                           | No                                  | Yes          | No                              |
| Accept and prepare orders        | No                           | Yes (kitchen roles)                 | No           | No                              |
| Deliver an order                 | No                           | No                                  | No           | Yes                             |
| Refund an order                  | Yes, approval above a limit  | Within a set limit                  | Can request  | No                              |
| Manage staff                     | Platform staff               | Own restaurant staff                | No           | No                              |
| Approve riders                   | Yes                          | No                                  | No           | No                              |
| Block users                      | Yes                          | Can report                          | Can report   | Can report                      |
| See customer contact details     | Masked, reveal with a reason | Active orders only                  | Own only     | Active deliveries only          |
| Run payouts                      | Approves                     | Views own                           | No           | Views own earnings              |
| Configure zones and settings     | Yes                          | Own hours and radius, within limits | No           | Own availability                |
| View the audit log               | All                          | Own restaurant's activity           | No           | No                              |
| Export data                      | Capped and logged            | Own restaurant                      | Own data     | Own data                        |

## 7. To confirm before sign-off

- Role names in section 2.
- The proposed thresholds and cooling-off periods in section 3.
- Whether Platform_Ops may pause new orders in a single zone during an emergency. Today only the
  owner can (`platform:pause_orders`).
- The domain for the `owner.` and `admin.` hosts.
