ALTER TABLE articles ADD COLUMN IF NOT EXISTS public_id text;
CREATE SEQUENCE IF NOT EXISTS article_public_id_seq START WITH 1;
WITH generated AS (
  SELECT id, nextval('article_public_id_seq')::text AS public_id
  FROM articles WHERE public_id IS NULL ORDER BY created_at, id
)
UPDATE articles article SET public_id = generated.public_id, slug = generated.public_id
FROM generated WHERE article.id = generated.id;
UPDATE qa_citations citation
SET slug = article.public_id,
    url = '/articles/' || article.public_id
FROM article_versions version
JOIN articles article ON article.id = version.article_id
WHERE citation.article_version_id = version.id;
ALTER TABLE articles ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS articles_public_id_unique ON articles (public_id);
ALTER TABLE articles ALTER COLUMN public_id SET DEFAULT nextval('article_public_id_seq')::text;
SELECT setval('article_public_id_seq', GREATEST(COALESCE((SELECT max(public_id::bigint) FROM articles), 0) + 1, 1), false);
ALTER TABLE article_versions ADD COLUMN IF NOT EXISTS source_filename text NOT NULL DEFAULT '';

UPDATE article_versions
SET content = '[]'::jsonb, content_text = '', source_mdx = '', source_filename = ''
WHERE status = 'archived';
