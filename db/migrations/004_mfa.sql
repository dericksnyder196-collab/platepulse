-- db/migrations/004_mfa.sql
-- Two-factor authentication. The authenticator secret is stored ENCRYPTED (AES-256-GCM, key in the
-- environment). Recovery codes are stored only as keyed hashes, so even the database owner cannot
-- read them.

CREATE TABLE IF NOT EXISTS user_mfa (
    user_id          BIGINT UNSIGNED NOT NULL,
    secret_encrypted VARCHAR(255)    NOT NULL,
    status           ENUM('pending', 'active') NOT NULL DEFAULT 'pending',
    -- Newest time step already accepted. A code from that step or earlier is rejected (no replay).
    last_used_step   BIGINT UNSIGNED NULL DEFAULT NULL,
    failed_attempts  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    locked_until     TIMESTAMP       NULL DEFAULT NULL,
    enrolled_at      TIMESTAMP       NULL DEFAULT NULL,
    created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_user_mfa_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id    BIGINT UNSIGNED NOT NULL,
    code_hash  CHAR(64)        NOT NULL,
    used_at    TIMESTAMP       NULL DEFAULT NULL,
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_mfa_recovery_user_hash (user_id, code_hash),
    CONSTRAINT fk_mfa_recovery_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
