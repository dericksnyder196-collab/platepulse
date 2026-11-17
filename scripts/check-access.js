/* scripts/check-access.js
 *
 * Checks the access rules: the permission catalog, the permission guard, and the scope guards that
 * keep owner sessions and ordinary sessions apart. Needs no database, server or .env.
 *
 * Usage:  npm run check:access
 */

const assert = require('node:assert/strict');
const {
    SCOPES,
    PERMISSIONS,
    ROLES,
    isKnownPermission,
    permissionsForRole
} = require('../private/config/permissions');
const requirePermission = require('../private/middleware/requirePermission');
const { requirePlatformScope, requireUserScope } = require('../private/middleware/scopeGuards');

let count = 0;
function check(name, fn) {
    fn();
    count++;
    console.log(`  ok  ${name}`);
}

// Runs one middleware against a fake request and reports what happened.
function run(middleware, user) {
    const outcome = { status: null, body: null, passed: false };
    const res = {
        status(code) {
            outcome.status = code;
            return this;
        },
        json(payload) {
            outcome.body = payload;
            return this;
        }
    };
    middleware({ user }, res, () => {
        outcome.passed = true;
    });
    return outcome;
}

const owner = { scope: 'platform', mfa: true, roles: ['Platform_Owner'] };
const finance = { scope: 'platform', mfa: true, roles: ['Platform_Finance'] };
const support = { scope: 'platform', mfa: true, roles: ['Platform_Support'] };
const ops = { scope: 'platform', mfa: true, roles: ['Platform_Ops'] };

console.log('Permission catalog');

check('there are 7 roles and 90 permissions', () => {
    assert.equal(ROLES.length, 7);
    assert.equal(PERMISSIONS.length, 90);
});

check('the owner holds every platform permission', () => {
    const held = new Set(permissionsForRole('Platform_Owner'));
    for (const permission of PERMISSIONS.filter((p) => p.scope === SCOPES.PLATFORM)) {
        assert.ok(held.has(permission.name), `owner is missing ${permission.name}`);
    }
});

check('every platform permission has a control level of 1, 2 or 3', () => {
    for (const permission of PERMISSIONS.filter((p) => p.scope === SCOPES.PLATFORM)) {
        assert.ok([1, 2, 3].includes(permission.controlLevel), permission.name);
    }
});

check('every high-impact (L3) approval action is held by at most Owner and Finance', () => {
    for (const permission of PERMISSIONS.filter(
        (p) => p.scope === SCOPES.PLATFORM && p.controlLevel === 3
    )) {
        for (const role of permission.roles) {
            assert.ok(
                ['Platform_Owner', 'Platform_Finance'].includes(role),
                `${role} holds L3 permission ${permission.name}`
            );
        }
    }
});

check('support has no money permissions', () => {
    const held = permissionsForRole('Platform_Support');
    for (const money of [
        'payout:approve',
        'order:refund_any',
        'commission:manage',
        'ledger:view_all'
    ]) {
        assert.ok(!held.includes(money), money);
    }
});

console.log('\nPermission guard');

check('an unknown permission is rejected when the route is defined', () => {
    assert.throws(() => requirePermission('not:real'));
    assert.throws(() => requirePermission('menu:edit')); // a restaurant permission, not a platform one
    assert.ok(isKnownPermission(SCOPES.PLATFORM, 'audit:view'));
});

check('the owner passes an owner-only permission', () => {
    assert.equal(run(requirePermission('audit:view'), owner).passed, true);
    assert.equal(run(requirePermission('security_policy:manage'), owner).passed, true);
});

check('support, finance and ops are refused owner-only permissions', () => {
    for (const user of [support, finance, ops]) {
        const result = run(requirePermission('audit:view'), user);
        assert.equal(result.passed, false);
        assert.equal(result.status, 403);
    }
});

check('roles pass only what the catalog gives them', () => {
    assert.equal(run(requirePermission('payout:approve'), finance).passed, true);
    assert.equal(run(requirePermission('payout:approve'), ops).passed, false);
    assert.equal(run(requirePermission('ticket:handle'), support).passed, true);
    assert.equal(run(requirePermission('ticket:handle'), finance).passed, false);
    assert.equal(run(requirePermission('commission:manage'), finance).passed, false);
});

check('a caller with no roles, or no user at all, is refused', () => {
    assert.equal(run(requirePermission('overview:view'), { roles: [] }).passed, false);
    assert.equal(run(requirePermission('overview:view'), undefined).passed, false);
});

console.log('\nScope guards (owner and ordinary sessions stay apart)');

check('a platform session with two-factor reaches the owner area', () => {
    assert.equal(run(requirePlatformScope, owner).passed, true);
});

check('ordinary sessions get 404 from the owner area', () => {
    const result = run(requirePlatformScope, { scope: 'user', mfa: false, roles: [] });
    assert.equal(result.passed, false);
    assert.equal(result.status, 404);
});

check('a platform session without a code (mfa false) is refused', () => {
    assert.equal(run(requirePlatformScope, { ...owner, mfa: false }).passed, false);
});

check('a platform scope claim with no roles is refused', () => {
    assert.equal(run(requirePlatformScope, { ...owner, roles: [] }).passed, false);
});

check('no session at all is refused', () => {
    assert.equal(run(requirePlatformScope, undefined).passed, false);
});

check('ordinary sessions reach restaurant routes', () => {
    assert.equal(run(requireUserScope, { scope: 'user', mfa: false, roles: [] }).passed, true);
});

check('owner sessions are refused on restaurant routes', () => {
    const result = run(requireUserScope, owner);
    assert.equal(result.passed, false);
    assert.equal(result.status, 403);
});

console.log(`\nAll ${count} checks passed.`);
