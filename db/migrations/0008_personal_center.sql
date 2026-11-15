ALTER TABLE users
  ADD COLUMN phone text,
  ADD COLUMN gender text CHECK (gender IS NULL OR gender IN ('male', 'female', 'other', 'undisclosed')),
  ADD COLUMN introduction text,
  ADD COLUMN avatar_key text,
  ADD COLUMN deleted_reason text;

DROP INDEX users_email_lower_unique;
CREATE UNIQUE INDEX users_email_lower_active_unique
  ON users (lower(email))
  WHERE del_flag = false;
