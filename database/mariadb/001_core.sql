CREATE TABLE IF NOT EXISTS admins (
 user_id CHAR(36) PRIMARY KEY, email VARCHAR(254) NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, totp_secret VARCHAR(128),
 singleton TINYINT NOT NULL DEFAULT 1 UNIQUE CHECK (singleton=1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS sessions (
 token_hash CHAR(64) PRIMARY KEY, user_id CHAR(36) NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 FOREIGN KEY (user_id) REFERENCES admins(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS password_resets (
 token_hash CHAR(64) PRIMARY KEY, user_id CHAR(36) NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 FOREIGN KEY (user_id) REFERENCES admins(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS questionnaire_versions (
 id CHAR(36) PRIMARY KEY, version INT NOT NULL UNIQUE, definition JSON NOT NULL,
 state VARCHAR(16) NOT NULL CHECK (state IN ('draft','published','archived')),
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 active_slot TINYINT GENERATED ALWAYS AS (CASE WHEN state='published' THEN 1 ELSE NULL END) STORED UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS applications (
 id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
 number BIGINT NOT NULL AUTO_INCREMENT UNIQUE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 idempotency_key CHAR(36) NOT NULL UNIQUE, payload_hash CHAR(64) NOT NULL,
 version_id CHAR(36) NOT NULL,
 questionnaire_snapshot JSON NOT NULL, contact JSON NOT NULL,
 address JSON NOT NULL, answers JSON NOT NULL,
 indication VARCHAR(24) NOT NULL CHECK (indication IN ('possible','review_needed')),
 reasons JSON NOT NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'Nieuw' CHECK (status IN ('Nieuw','In behandeling','Afgerond')),
 review_status VARCHAR(24) NOT NULL DEFAULT 'Nog te controleren' CHECK (review_status IN ('Nog te controleren','Gecontroleerd')),
 reviewed_at DATETIME(3), reviewed_by CHAR(36), note TEXT NOT NULL DEFAULT '', search_text TEXT NOT NULL,
 FOREIGN KEY (version_id) REFERENCES questionnaire_versions(id),
 FOREIGN KEY (reviewed_by) REFERENCES admins(user_id),
 CHECK ((review_status='Gecontroleerd' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL) OR (review_status='Nog te controleren' AND reviewed_at IS NULL AND reviewed_by IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS notification_outbox (
 id CHAR(36) PRIMARY KEY DEFAULT (UUID()), application_id CHAR(36) NOT NULL UNIQUE,
 status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','delivered','failed')),
 attempts INT NOT NULL DEFAULT 0, next_attempt_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 delivered_at DATETIME(3),
 FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS application_audit (
 id CHAR(36) PRIMARY KEY DEFAULT (UUID()), application_id CHAR(36) NOT NULL,
 actor CHAR(36) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), changes JSON NOT NULL,
 FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
 FOREIGN KEY (actor) REFERENCES admins(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
