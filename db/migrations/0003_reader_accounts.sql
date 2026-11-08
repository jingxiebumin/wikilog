-- Issue 04: password accounts without email verification or email delivery.
-- Existing pending rows were created by the pre-account schema. They are
-- immediately usable after this migration; deployment operators can disable
-- individual rows separately when needed.
UPDATE users
SET status = CASE WHEN password_hash IS NULL THEN 'disabled' ELSE 'active' END,
    updated_at = now()
WHERE status = 'pending';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_status_check,
  DROP COLUMN IF EXISTS email_verified_at,
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE users
  ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'disabled'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_required boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS reader_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reader_sessions_user_idx ON reader_sessions (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS reader_sessions_active_token_idx
  ON reader_sessions (token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  reason text NOT NULL,
  result text NOT NULL CHECK (result IN ('success', 'failed'))
);

CREATE INDEX IF NOT EXISTS admin_password_resets_target_idx
  ON admin_password_resets (target_user_id, created_at DESC);

-- A single row per scope/key lets PostgreSQL atomically consume an attempt
-- across multiple web processes. The application supplies the configured
-- window and limit for each operation.
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz
);
