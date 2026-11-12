CREATE TABLE admin_reader_status_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_email text NOT NULL,
  previous_status text NOT NULL CHECK (previous_status IN ('active', 'disabled')),
  new_status text NOT NULL CHECK (new_status IN ('active', 'disabled')),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_reader_status_changes_target_idx
  ON admin_reader_status_changes (target_user_id, created_at DESC);
