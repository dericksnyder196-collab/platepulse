/* private/config/permissions.js
 *
 * The permission catalog: the code version of docs/access-model.md. Keep the two in step.
 * `npm run seed:rbac` syncs this into the roles, permissions and role_permissions tables.
 *
 * Platform rows:  [name, controlLevel, requiresApproval, roles, description]
 *   roles letters: O Platform_Owner, F Platform_Finance, S Platform_Support, P Platform_Ops
 * Tenant rows:    [name, roles, description]
 *   roles letters: A Restaurant_Admin, S Shift_Manager, C Line_Cook
 *
 * controlLevel: 1 routine, 2 reversible (reason and audit), 3 high impact (fresh MFA and a reason).
 * requiresApproval: the action also follows the approval policy (second approver, or cooling-off).
 */

const SCOPES = Object.freeze({ PLATFORM: 'platform', TENANT: 'tenant' });

const PLATFORM_ROLE_LETTERS = {
    O: 'Platform_Owner',
    F: 'Platform_Finance',
    S: 'Platform_Support',
    P: 'Platform_Ops'
};

const TENANT_ROLE_LETTERS = {
    A: 'Restaurant_Admin',
    S: 'Shift_Manager',
    C: 'Line_Cook'
};

const PLATFORM_ROWS = [
    // Home and search
    ['overview:view', 1, false, 'OFSP', 'See Home numbers and the needs-attention queue'],
    ['search:global', 1, false, 'OFSP', 'Search restaurants, people and orders'],

    // Restaurants
    ['restaurant:view', 1, false, 'OFSP', 'List, profile and read-only menu snapshot'],
    ['restaurant:export', 1, false, 'OFP', 'Export the restaurant list as CSV'],
    ['restaurant:note', 1, false, 'OFSP', 'Internal notes, tags and assigned account manager'],
    [
        'restaurant:review_application',
        2,
        false,
        'OP',
        'Approve, request changes or reject an application'
    ],
    ['restaurant:set_status', 2, false, 'OP', 'Put live, suspend or reinstate a restaurant'],
    [
        'restaurant:edit_settings',
        2,
        false,
        'OP',
        'Delivery radius, prep-time cap, payment methods, featured flag'
    ],
    [
        'restaurant:emergency_hide',
        2,
        false,
        'OP',
        'Hide a menu item or menu, pause new orders for one restaurant'
    ],
    ['restaurant:bulk_action', 2, false, 'OP', 'Bulk message, export or tag'],
    ['restaurant:terminate', 3, true, 'O', 'Terminate a restaurant permanently'],
    ['restaurant:transfer_admin', 3, true, 'O', 'Move a restaurant to a new admin'],

    // Restaurant staff accounts
    [
        'staff_account:view',
        1,
        false,
        'OSP',
        'See a restaurant\u2019s staff, roles, last login and MFA status'
    ],
    [
        'staff_account:force_signout',
        2,
        false,
        'OS',
        'Force sign-out, require a password reset, lock an account'
    ],

    // Riders
    ['rider:view', 1, false, 'OFSP', 'List, profile and performance'],
    ['rider:view_live_map', 1, false, 'OSP', 'Live map of online riders and active deliveries'],
    [
        'rider:review_application',
        2,
        false,
        'OP',
        'Review documents, approve, reject or ask for resubmission'
    ],
    ['rider:set_status', 2, false, 'OP', 'Suspend and reinstate riders'],
    ['rider:manage_zones', 2, false, 'OP', 'Rider zones and shifts'],
    ['rider:warn', 2, false, 'OP', 'Performance warnings and rating review'],
    ['rider:deactivate', 3, false, 'O', 'Deactivate a rider permanently'],
    ['rider:settle_cash', 3, true, 'OF', 'Settle cash-on-delivery balances'],

    // Customers
    ['customer:view', 1, false, 'OFSP', 'Masked profile, order, refund and complaint history'],
    ['customer:reveal_contact', 2, false, 'OS', 'Reveal a masked phone or email, with a reason'],
    ['customer:block', 2, false, 'OS', 'Block, unblock or limit a customer'],
    ['customer:review_fraud_flag', 2, false, 'OS', 'Review and clear fraud flags'],
    ['data_request:view', 1, false, 'OS', 'See data export and deletion requests'],
    ['data_request:complete', 3, true, 'O', 'Complete a deletion or export request'],

    // Orders and operations
    ['order:view_any', 1, false, 'OFSP', 'Orders explorer, live board and order timeline'],
    [
        'order:intervene',
        2,
        false,
        'OSP',
        'Cancel, reassign a rider, resend a notification, mark failed'
    ],
    ['order:refund_request', 2, false, 'OSP', 'Propose a refund for approval'],
    ['order:refund_any', 3, true, 'OF', 'Issue a full or partial refund'],
    ['dispute:view', 1, false, 'OFSP', 'See the dispute queue and evidence'],
    ['dispute:resolve', 2, false, 'OS', 'Record a dispute decision'],
    ['platform:pause_orders', 3, false, 'O', 'Pause new orders platform-wide or in one zone'],

    // Money
    ['ledger:view_all', 1, false, 'OF', 'Read-only ledger across all restaurants'],
    ['ledger:export', 1, false, 'OF', 'Export ledger entries (capped and logged)'],
    [
        'ledger:integrity_view',
        1,
        false,
        'OFP',
        'Hash-chain verification status and daily checkpoints'
    ],
    ['payout:view', 1, false, 'OF', 'See payouts and statements'],
    ['reconciliation:view', 1, false, 'OF', 'Provider statements against the ledger'],
    [
        'financial_report:view',
        1,
        false,
        'OF',
        'Revenue, commission, payouts, taxes and cash on delivery'
    ],
    ['payout:prepare', 2, false, 'OF', 'Generate a payout batch for review'],
    ['promo_budget:manage', 2, false, 'OF', 'Track and adjust platform-funded promotion budgets'],
    [
        'payout:approve',
        3,
        true,
        'OF',
        'Approve a payout batch (approver differs from the preparer)'
    ],
    ['payout:hold', 3, false, 'OF', 'Hold a single payout'],
    ['payout:freeze', 3, false, 'O', 'Freeze all payouts at once'],
    ['chargeback:handle', 3, true, 'OF', 'Handle chargebacks'],
    ['reconciliation:resolve', 3, true, 'OF', 'Resolve a reconciliation difference'],
    ['commission:manage', 3, true, 'O', 'Commission rules with effective dates'],
    ['delivery_fee:manage', 3, true, 'O', 'Delivery fee rules by zone'],
    ['tax:manage', 3, true, 'O', 'Tax rules'],

    // Marketing and content
    ['taxonomy:manage', 2, false, 'OP', 'Cuisines, dietary and allergen tags, categories'],
    ['content:manage', 2, false, 'OP', 'Home banners, featured restaurants and collections'],
    ['campaign:manage', 2, false, 'OP', 'Platform promo codes and campaigns with budget caps'],
    ['message_campaign:send', 2, true, 'OP', 'Push, SMS and email campaigns'],
    ['review:moderate', 2, false, 'OS', 'Hide and restore reviews'],
    ['legal:manage', 3, true, 'O', 'Terms and privacy policy versions, forced re-consent'],

    // Platform settings and feature flags
    ['zone:manage', 2, false, 'OP', 'Service areas drawn as zones'],
    [
        'settings:edit',
        2,
        false,
        'OP',
        'Hours, radius, minimum orders, languages, currencies, templates'
    ],
    ['flag:manage', 2, false, 'OP', 'Feature flags with audience, history and rollback'],
    ['payment_method:toggle', 3, false, 'O', 'Turn a payment method on or off, per zone'],
    ['maintenance:toggle', 3, false, 'O', 'Maintenance mode and the app-wide banner'],

    // Support and trust
    ['ticket:view', 1, false, 'OSP', 'Ticket inbox'],
    ['fraud_signal:view', 1, false, 'OFS', 'Order velocity, repeated cancellations, GPS anomalies'],
    ['ticket:handle', 2, false, 'OS', 'Assign, reply to and close tickets'],
    [
        'abuse_report:decide',
        2,
        false,
        'OS',
        'Close reports against restaurants, riders and customers'
    ],
    ['blocklist:manage', 2, false, 'OS', 'Block phone numbers and devices'],

    // Team, access and security
    ['platform_staff:view', 1, false, 'O', 'Role and permission viewer, access review'],
    ['audit:view', 1, false, 'O', 'Search the audit log'],
    ['audit:export', 1, false, 'O', 'Export audit entries (capped and logged)'],
    ['security:view', 1, false, 'OP', 'Security center'],
    ['consent:view', 1, false, 'OS', 'Consent and policy acceptance records'],
    [
        'system:view_health',
        1,
        false,
        'OP',
        'Uptime, errors, latency, database connections, jobs, backups'
    ],
    ['analytics:view', 1, false, 'OFP', 'Cohorts, funnel, leaderboards and demand maps'],
    ['incident:manage', 2, false, 'OP', 'Incident log and the status-page message'],
    ['analytics:schedule', 2, false, 'OFP', 'Saved views and scheduled reports'],
    ['platform_staff:manage', 3, true, 'O', 'Invite platform staff, assign roles, remove access'],
    ['security_policy:manage', 3, false, 'O', 'Require MFA, session lengths, IP allowlist'],
    ['approval_rules:manage', 3, true, 'O', 'Which actions need approval, and the thresholds']
];

// Provisional: finalized in the Admin dashboard plan.
const TENANT_ROWS = [
    ['menu:create', 'AS', 'Create menu items and categories'],
    ['menu:edit', 'AS', 'Edit items, prices, availability and translations'],
    ['order:view', 'ASC', 'See the restaurant\u2019s orders'],
    ['order:update_kitchen', 'ASC', 'Accept, prepare and mark orders ready'],
    ['order:update', 'AS', 'Cancel an order and other status changes'],
    ['order:refund', 'AS', 'Refund within the limit set by the admin'],
    ['analytics:view', 'AS', 'Restaurant sales and preparation metrics'],
    ['financials:view', 'A', 'Earnings, fees, payouts and statements'],
    ['storefront:edit', 'A', 'Banner, description and hours'],
    ['staff:invite', 'A', 'Invite staff'],
    ['staff:manage', 'A', 'Change roles and remove staff']
];

const ROLE_DESCRIPTIONS = {
    Platform_Owner: 'Runs PlatePulse. Holds every platform permission.',
    Platform_Finance: 'Money views, payout preparation and approval.',
    Platform_Support: 'People, orders, disputes and tickets. No money movement.',
    Platform_Ops: 'Restaurants, riders, zones, settings and system health.',
    Restaurant_Admin: 'Runs one restaurant, including staff and financials.',
    Shift_Manager: 'Day-to-day management within limits set by the admin.',
    Line_Cook: 'Kitchen queue only.'
};

function lettersToRoles(letters, table, label) {
    return [...letters].map((letter) => {
        const role = table[letter];
        if (!role) throw new Error(`permissions.js: unknown role letter "${letter}" in ${label}`);
        return role;
    });
}

const PERMISSIONS = [
    ...PLATFORM_ROWS.map(([name, controlLevel, requiresApproval, letters, description]) => ({
        name,
        scope: SCOPES.PLATFORM,
        controlLevel,
        requiresApproval,
        description,
        roles: lettersToRoles(letters, PLATFORM_ROLE_LETTERS, name)
    })),
    ...TENANT_ROWS.map(([name, letters, description]) => ({
        name,
        scope: SCOPES.TENANT,
        controlLevel: null,
        requiresApproval: false,
        description,
        roles: lettersToRoles(letters, TENANT_ROLE_LETTERS, name)
    }))
];

const ROLES = [
    ...Object.values(PLATFORM_ROLE_LETTERS).map((name) => ({ name, scope: SCOPES.PLATFORM })),
    ...Object.values(TENANT_ROLE_LETTERS).map((name) => ({ name, scope: SCOPES.TENANT }))
].map((role) => ({
    ...role,
    description: ROLE_DESCRIPTIONS[role.name],
    permissions: PERMISSIONS.filter(
        (permission) => permission.scope === role.scope && permission.roles.includes(role.name)
    ).map((permission) => permission.name)
}));

// ---------- Checks that run when the file loads ----------
const seen = new Set();
for (const permission of PERMISSIONS) {
    const key = `${permission.scope}:${permission.name}`;
    if (seen.has(key)) throw new Error(`permissions.js: duplicate permission ${key}`);
    seen.add(key);

    if (!/^[a-z_]+:[a-z_]+$/.test(permission.name)) {
        throw new Error(`permissions.js: "${permission.name}" must look like domain:action`);
    }
    if (permission.scope === SCOPES.PLATFORM) {
        if (![1, 2, 3].includes(permission.controlLevel)) {
            throw new Error(
                `permissions.js: ${permission.name} needs a control level of 1, 2 or 3`
            );
        }
        if (!permission.roles.includes('Platform_Owner')) {
            throw new Error(`permissions.js: Platform_Owner must hold ${permission.name}`);
        }
    }
}

function isKnownPermission(scope, name) {
    return seen.has(`${scope}:${name}`);
}

function getPermission(scope, name) {
    return PERMISSIONS.find((p) => p.scope === scope && p.name === name) || null;
}

function permissionsForRole(roleName) {
    const role = ROLES.find((candidate) => candidate.name === roleName);
    return role ? [...role.permissions] : [];
}

module.exports = Object.freeze({
    SCOPES,
    PERMISSIONS,
    ROLES,
    isKnownPermission,
    getPermission,
    permissionsForRole
});
