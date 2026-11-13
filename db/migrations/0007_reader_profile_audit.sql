CREATE TABLE admin_reader_profile_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  previous_email text NOT NULL,
  new_email text NOT NULL,
  previous_display_name text NOT NULL,
  new_display_name text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_reader_profile_changes_target_idx
  ON admin_reader_profile_changes (target_user_id, created_at DESC);
