CREATE TABLE qa_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '新问答',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  del_flag boolean NOT NULL DEFAULT false,
  next_submission_sequence bigint NOT NULL DEFAULT 1 CHECK (next_submission_sequence > 0)
);

CREATE INDEX qa_sessions_admin_updated_idx ON qa_sessions (admin_id, updated_at DESC) WHERE del_flag = false;

CREATE TABLE qa_daily_quotas (
  admin_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quota_day date NOT NULL,
  successful_count integer NOT NULL DEFAULT 0 CHECK (successful_count BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  del_flag boolean NOT NULL DEFAULT false,
  PRIMARY KEY (admin_id, quota_day)
);

CREATE TABLE qa_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES qa_sessions(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quota_day date NOT NULL,
  submission_sequence bigint NOT NULL CHECK (submission_sequence > 0),
  question text NOT NULL CHECK (char_length(question) BETWEEN 1 AND 2000),
  answer text,
  status text NOT NULL CHECK (status IN ('queued', 'processing', 'succeeded', 'refused', 'failed', 'timed_out')),
  model_id text,
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  del_flag boolean NOT NULL DEFAULT false
);

CREATE INDEX qa_messages_session_order_idx ON qa_messages (session_id, created_at, id) WHERE del_flag = false;

CREATE TABLE qa_citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES qa_messages(id) ON DELETE CASCADE,
  article_version_id uuid NOT NULL REFERENCES article_versions(id) ON DELETE RESTRICT,
  slug text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  quote text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  del_flag boolean NOT NULL DEFAULT false
);

CREATE INDEX qa_citations_message_idx ON qa_citations (message_id) WHERE del_flag = false;
