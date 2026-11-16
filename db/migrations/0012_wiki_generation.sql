CREATE TABLE wiki_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('initial', 'update')),
  article_version_id uuid REFERENCES article_versions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  failure_code text CHECK (failure_code IS NULL OR failure_code IN ('provider_failed', 'invalid_candidate', 'no_published_articles')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wiki_generation_job_subject_check CHECK (
    (kind = 'initial' AND article_version_id IS NULL)
    OR (kind = 'update' AND article_version_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX wiki_generation_initial_active_idx ON wiki_generation_jobs (kind)
  WHERE kind = 'initial' AND status IN ('queued', 'running', 'succeeded');
CREATE UNIQUE INDEX wiki_generation_update_version_active_idx ON wiki_generation_jobs (article_version_id)
  WHERE kind = 'update' AND status IN ('queued', 'running', 'succeeded');
CREATE INDEX wiki_generation_queue_idx ON wiki_generation_jobs (created_at, id)
  WHERE status = 'queued';
