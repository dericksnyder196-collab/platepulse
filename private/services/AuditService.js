/* private/services/AuditService.js
 *
 * Writes the audit trail. Rules:
 *  - For L2 and L3 actions, call record() with the SAME transaction connection as the change, so
 *    there is never a change without an event, or an event for a change that failed.
 *  - A failed audit write throws. The action must not go ahead without its record.
 *  - Sensitive fields (passwords, tokens, hashes, codes) are redacted from payloads.
 */

const crypto = require('crypto');
const DatabaseController = require('../core/DatabaseController');
const { Scope } = require('../core/scope');

const ACTOR_SCOPES = ['platform', 'tenant', 'user', 'system', 'anonymous'];
const ACTION_PATTERN = /^[A-Z][A-Z0-9_]{2,99}$/;
const SENSITIVE_KEY = /pass(word)?|secret|token|hash|code|otp|mfa|recovery|authorization|cookie/i;
const MAX_DEPTH = 5;
const MAX_PAYLOAD_BYTES = 16 * 1024;

/** Returns a copy of `value` with sensitive keys replaced and depth limited. */
function redact(value, depth = 0) {
    if (value === null || value === undefined) return value;
    if (depth > MAX_DEPTH) return '[truncated]';
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return '[binary]';
    if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

    if (typeof value === 'object') {
        const copy = {};
        for (const [key, inner] of Object.entries(value)) {
            copy[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(inner, depth + 1);
        }
        return copy;
    }

    if (typeof value === 'function' || typeof value === 'symbol') return undefined;
    return value;
}

/** Serializes a payload for a JSON column. Oversized payloads are replaced by a marker. */
function serializePayload(value) {
    if (value === null || value === undefined) return null;
    const json = JSON.stringify(redact(value));
    const bytes = Buffer.byteLength(json);
    if (bytes > MAX_PAYLOAD_BYTES) return JSON.stringify({ truncated: true, bytes });
    return json;
}

/** Builds the "who and from where" part of an event from an Express request. */
function contextFromRequest(req, overrides = {}) {
    const user = req.user || null;
    return {
        actorId: user ? user.id : null,
        actorScope: user ? user.scope || 'user' : 'anonymous',
        ip: req.ip || null,
        userAgent: req.get ? req.get('user-agent') || null : null,
        requestId: req.id || null,
        ...overrides
    };
}

function clip(value, max) {
    if (value === null || value === undefined) return null;
    return String(value).slice(0, max);
}

/**
 * record({ context, action, entity, entityId, tenantId, reason, before, after }, connection?)
 * Returns the new event's UUID.
 */
async function record(event, connection = null) {
    const { context = {}, action, entity, entityId, tenantId, reason, before, after } = event;

    if (typeof action !== 'string' || !ACTION_PATTERN.test(action)) {
        throw new Error('AuditService: action must look like ORDER_REFUNDED.');
    }

    const actorScope = context.actorScope || 'system';
    if (!ACTOR_SCOPES.includes(actorScope)) {
        throw new Error(`AuditService: unknown actor scope "${actorScope}".`);
    }

    const eventUuid = crypto.randomUUID();

    const sql = `INSERT INTO audit_events
        (event_uuid, actor_id, actor_scope, tenant_id, action_type, target_entity, target_id,
         reason, old_payload, new_payload, ip_address, user_agent, request_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await DatabaseController.query(
        sql,
        [
            eventUuid,
            context.actorId ?? null,
            actorScope,
            tenantId ?? null,
            action,
            clip(entity, 100),
            clip(entityId, 64),
            clip(reason, 500),
            serializePayload(before),
            serializePayload(after),
            clip(context.ip, 45),
            clip(context.userAgent, 255),
            clip(context.requestId, 64)
        ],
        Scope.GLOBAL,
        connection
    );

    return eventUuid;
}

module.exports = { record, contextFromRequest, redact, serializePayload };
