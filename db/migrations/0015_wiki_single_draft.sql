WITH obsolete_drafts AS (
  SELECT id, row_number() OVER (
    PARTITION BY page_id ORDER BY updated_at DESC, created_at DESC, id DESC
  ) AS position
  FROM wiki_page_versions
  WHERE status = 'draft' AND del_flag = false
)
DELETE FROM wiki_page_versions version
USING obsolete_drafts draft
WHERE version.id = draft.id AND draft.position > 1;

DELETE FROM wiki_page_versions WHERE status = 'archived';

INSERT INTO wiki_page_version_relations (page_version_id, related_page_id, created_by, updated_by)
SELECT target.current_published_version_id, owner.id, relation.created_by, relation.updated_by
FROM wiki_page_version_relations relation
JOIN wiki_pages owner ON owner.current_published_version_id = relation.page_version_id
  AND owner.state = 'active' AND owner.del_flag = false
JOIN wiki_page_versions owner_version ON owner_version.id = owner.current_published_version_id
  AND owner_version.status = 'published' AND owner_version.del_flag = false
JOIN wiki_pages target ON target.id = relation.related_page_id
  AND target.state = 'active' AND target.del_flag = false
JOIN wiki_page_versions target_version ON target_version.id = target.current_published_version_id
  AND target_version.status = 'published' AND target_version.del_flag = false
WHERE relation.del_flag = false AND owner.id <> target.id
ON CONFLICT (page_version_id, related_page_id) DO NOTHING;

CREATE UNIQUE INDEX wiki_page_one_draft_per_page_idx
  ON wiki_page_versions (page_id)
  WHERE status = 'draft' AND del_flag = false;
