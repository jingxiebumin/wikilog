CREATE TABLE article_version_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_version_id uuid NOT NULL REFERENCES article_versions(id) ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE,
  original_name text NOT NULL,
  content_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_version_id, original_name)
);

CREATE INDEX article_version_assets_version_idx
  ON article_version_assets (article_version_id);
