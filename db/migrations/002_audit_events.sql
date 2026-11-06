-- db/migrations/002_audit_events.sql
-- Append-only record of every important action. Written in the same transaction as the change it
-- describes. There are deliberately NO foreign keys: audit rows must outlive the users and
-- restaurants they mention.
--
-- Hardening to add when the runtime and migration database users are split (Build Guide Step 0):
--   REVOKE UPDATE, DELETE ON audit_events FROM the runtime user, so the app can only INSERT and SELECT.

CREATE TABLE IF NOT EXISTS audit_events (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_uuid     CHAR(36)        NOT NULL,
    actor_id       BIGINT UNSIGNED NULL,
    actor_scope    ENUM('platform', 'tenant', 'user', 'system', 'anonymous') NOT NULL,
    tenant_id      BIGINT UNSIGNED NULL,
    action_type    VARCHAR(100)    NOT NULL,
    target_entity  VARCHAR(100)    NULL,
    target_id      VARCHAR(64)     NULL,
    reason         VARCHAR(500)    NULL,
    old_payload    JSON            NULL,
    new_payload    JSON            NULL,
    ip_address     VARCHAR(45)     NULL,
    user_agent     VARCHAR(255)    NULL,
    request_id     VARCHAR(64)     NULL,
    created_at     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_audit_events_uuid (event_uuid),
    KEY idx_audit_events_actor (actor_id, created_at),
    KEY idx_audit_events_tenant (tenant_id, created_at),
    KEY idx_audit_events_action (action_type, created_at),
    KEY idx_audit_events_target (target_entity, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
