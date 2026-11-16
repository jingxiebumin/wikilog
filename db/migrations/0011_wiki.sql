CREATE TABLE wiki_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'merged')),
  current_published_version_id uuid,
  redirect_to_page_id uuid REFERENCES wiki_pages(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  del_flag boolean NOT NULL DEFAULT false,
  CONSTRAINT wiki_pages_merge_target_check CHECK (
    (state = 'active' AND redirect_to_page_id IS NULL)
    OR (state = 'merged' AND redirect_to_page_id IS NOT NULL AND redirect_to_page_id <> id)
  )
);

CREATE TABLE wiki_page_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  status text NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  merge_source_page_id uuid REFERENCES wiki_pages(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  del_flag boolean NOT NULL DEFAULT false,
  UNIQUE (page_id, version_number),
  UNIQUE (id, page_id)
);

ALTER TABLE wiki_pages
  ADD CONSTRAINT wiki_pages_current_version_fk
  FOREIGN KEY (current_published_version_id, id)
  REFERENCES wiki_page_versions (id, page_id)
  ON DELETE SET NULL (current_published_version_id);

CREATE TABLE wiki_page_version_sources (
  page_version_id uuid NOT NULL REFERENCES wiki_page_versions(id) ON DELETE CASCADE,
  article_version_id uuid NOT NULL REFERENCES article_versions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  del_flag boolean NOT NULL DEFAULT false,
  PRIMARY KEY (page_version_id, article_version_id)
);

CREATE TABLE wiki_page_version_relations (
  page_version_id uuid NOT NULL REFERENCES wiki_page_versions(id) ON DELETE CASCADE,
  related_page_id uuid NOT NULL REFERENCES wiki_pages(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  del_flag boolean NOT NULL DEFAULT false,
  PRIMARY KEY (page_version_id, related_page_id)
);

CREATE INDEX wiki_page_versions_status_idx ON wiki_page_versions (status, page_id);
CREATE INDEX wiki_page_sources_article_version_idx ON wiki_page_version_sources (article_version_id, page_version_id)
  WHERE del_flag = false;
CREATE INDEX wiki_page_relations_target_idx ON wiki_page_version_relations (related_page_id, page_version_id)
  WHERE del_flag = false;
