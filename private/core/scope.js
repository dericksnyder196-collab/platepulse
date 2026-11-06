/* private/core/scope.js
 *
 * Every database query must declare its scope. There is no default, so a query that forgets
 * to declare one fails instead of silently reading across tenants (it "fails closed").
 *
 *   Scope.tenant(id)  Tenant-owned tables, limited to one restaurant.
 *   Scope.PLATFORM    Tenant-owned tables across ALL restaurants. Platform (owner) code only:
 *                     a lint rule forbids it outside private/platform/.
 *   Scope.GLOBAL      Tables that are not tenant-owned (users, tenants, roles, audit_events).
 *
 * Queries on tenant-owned tables mark where the filter goes with {tenant}, or {tenant:alias}
 * when the query joins several tables:
 *
 *   SELECT * FROM menu_items WHERE {tenant} AND id = ?
 *   SELECT o.id FROM orders o JOIN order_items i ON i.order_id = o.id WHERE {tenant:o} AND {tenant:i}
 *
 * Limit: the placeholder counter treats every ? as a bind parameter, so do not put a literal
 * question mark inside a quoted string in a scoped query.
 */

// Finds {tenant} and {tenant:alias}. The alias is validated separately in parseMarker, which
// keeps this pattern simple.
const MARKER = /\{tenant[^}]*\}/g;
const ALIAS = /^:([A-Za-z_][A-Za-z0-9_]*)$/;

function parseMarker(text) {
    const inner = text.slice('{tenant'.length, -1);
    if (inner === '') return null;
    const match = ALIAS.exec(inner);
    if (!match) throw new Error(`Invalid tenant marker: ${text}`);
    return match[1];
}

const KIND = Object.freeze({ TENANT: 'tenant', PLATFORM: 'platform', GLOBAL: 'global' });

// Only scopes created in this file are accepted. A look-alike object (for example one built
// from request JSON) is rejected.
const issued = new WeakSet();

function issue(scope) {
    const frozen = Object.freeze(scope);
    issued.add(frozen);
    return frozen;
}

const Scope = Object.freeze({
    GLOBAL: issue({ kind: KIND.GLOBAL }),
    PLATFORM: issue({ kind: KIND.PLATFORM }),
    tenant(tenantId) {
        if (!Number.isSafeInteger(tenantId) || tenantId <= 0) {
            throw new Error('Scope.tenant() needs a positive integer tenant id.');
        }
        return issue({ kind: KIND.TENANT, tenantId });
    }
});

function markerSql(scope, alias) {
    if (scope.kind === KIND.PLATFORM) return '1 = 1';
    return `${alias ? `${alias}.` : ''}tenant_id = ?`;
}

function countPlaceholders(text) {
    return (text.match(/\?/g) || []).length;
}

/**
 * Returns { sql, params } with every {tenant} marker resolved for the given scope.
 * Throws if the scope is missing or does not fit the query.
 */
function applyScope(sql, params, scope) {
    if (!issued.has(scope)) {
        throw new Error(
            'A database scope is required: Scope.tenant(id), Scope.PLATFORM or Scope.GLOBAL.'
        );
    }
    if (!Array.isArray(params)) {
        throw new Error('Query parameters must be an array.');
    }

    const markers = [...sql.matchAll(MARKER)];

    if (scope.kind === KIND.GLOBAL) {
        if (markers.length > 0) {
            throw new Error('A Scope.GLOBAL query must not contain a {tenant} marker.');
        }
        return { sql, params: [...params] };
    }

    if (markers.length === 0) {
        throw new Error(
            `A ${scope.kind}-scoped query must contain a {tenant} marker (use {tenant:alias} in joins).`
        );
    }

    // Walk the SQL, resolving each marker and inserting the tenant id at the right position
    // among the existing placeholders.
    let resolvedSql = '';
    const resolvedParams = [];
    let cursor = 0;
    let used = 0;

    for (const match of markers) {
        const segment = sql.slice(cursor, match.index);
        const count = countPlaceholders(segment);

        resolvedParams.push(...params.slice(used, used + count));
        used += count;

        resolvedSql += segment + markerSql(scope, parseMarker(match[0]));
        if (scope.kind === KIND.TENANT) resolvedParams.push(scope.tenantId);

        cursor = match.index + match[0].length;
    }

    resolvedSql += sql.slice(cursor);
    resolvedParams.push(...params.slice(used));

    return { sql: resolvedSql, params: resolvedParams };
}

module.exports = { Scope, applyScope };
