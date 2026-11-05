CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text NOT NULL,
  password_hash text,
  role text NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'admin')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled')),
  email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  tone text NOT NULL DEFAULT 'blue' CHECK (tone IN ('coral', 'green', 'blue')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  current_published_version_id uuid,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE article_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  status text NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  title text NOT NULL,
  summary text NOT NULL,
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_text text NOT NULL DEFAULT '',
  cover text NOT NULL,
  read_minutes integer NOT NULL CHECK (read_minutes > 0),
  published_at date,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT article_versions_article_version_unique UNIQUE (article_id, version_number),
  CONSTRAINT article_versions_id_article_unique UNIQUE (id, article_id),
  CONSTRAINT article_versions_published_date_check CHECK (status <> 'published' OR published_at IS NOT NULL)
);

ALTER TABLE articles
  ADD CONSTRAINT articles_current_published_version_fk
  FOREIGN KEY (current_published_version_id, id)
  REFERENCES article_versions (id, article_id)
  ON DELETE SET NULL (current_published_version_id);

CREATE TABLE article_version_tags (
  article_version_id uuid NOT NULL REFERENCES article_versions(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_version_id, tag_id)
);

CREATE INDEX article_versions_status_published_at_idx
  ON article_versions (status, published_at DESC);
CREATE INDEX articles_category_idx ON articles (category_id);
CREATE INDEX article_version_tags_tag_idx ON article_version_tags (tag_id, article_version_id);
