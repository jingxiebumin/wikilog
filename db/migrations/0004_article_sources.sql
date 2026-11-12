ALTER TABLE article_versions
  ADD COLUMN source_mdx text NOT NULL DEFAULT '';

CREATE INDEX article_versions_article_status_idx
  ON article_versions (article_id, status, version_number DESC);
