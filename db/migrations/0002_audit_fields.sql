ALTER TABLE users
  ADD COLUMN created_by uuid,
  ADD COLUMN updated_by uuid,
  ADD COLUMN del_flag boolean NOT NULL DEFAULT false;

ALTER TABLE users
  ADD CONSTRAINT users_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT users_updated_by_fk
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE categories
  ADD COLUMN created_by uuid,
  ADD COLUMN updated_by uuid,
  ADD COLUMN del_flag boolean NOT NULL DEFAULT false;

ALTER TABLE categories
  ADD CONSTRAINT categories_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT categories_updated_by_fk
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE tags
  ADD COLUMN created_by uuid,
  ADD COLUMN updated_by uuid,
  ADD COLUMN del_flag boolean NOT NULL DEFAULT false;

ALTER TABLE tags
  ADD CONSTRAINT tags_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT tags_updated_by_fk
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE articles
  ADD COLUMN created_by uuid,
  ADD COLUMN updated_by uuid,
  ADD COLUMN del_flag boolean NOT NULL DEFAULT false;

ALTER TABLE articles
  ADD CONSTRAINT articles_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT articles_updated_by_fk
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

UPDATE articles
SET del_flag = deleted_at IS NOT NULL;

ALTER TABLE article_versions
  ADD COLUMN updated_by uuid,
  ADD COLUMN del_flag boolean NOT NULL DEFAULT false;

ALTER TABLE article_versions
  ADD CONSTRAINT article_versions_updated_by_fk
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE article_version_tags
  ADD COLUMN updated_at timestamptz,
  ADD COLUMN created_by uuid,
  ADD COLUMN updated_by uuid,
  ADD COLUMN del_flag boolean NOT NULL DEFAULT false;

UPDATE article_version_tags
SET updated_at = created_at;

ALTER TABLE article_version_tags
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL,
  ADD CONSTRAINT article_version_tags_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT article_version_tags_updated_by_fk
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
