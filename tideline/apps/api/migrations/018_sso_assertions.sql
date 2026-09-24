-- Single-use ledger for Locally -> Tideline SSO assertions (see AuthService.exchangeSso).
-- A Locally-signed assertion may be exchanged for a Tideline session exactly once.
CREATE TABLE IF NOT EXISTS sso_assertions (jti TEXT PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS sso_assertions_expires_at_idx ON sso_assertions(expires_at);
