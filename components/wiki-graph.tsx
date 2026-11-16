import Link from "next/link";
import type { PublishedWikiPage } from "@/lib/wiki/repository";
import styles from "@/app/wiki/wiki.module.css";

type WikiGraphProps = { pages: PublishedWikiPage[] };

export function WikiGraph({ pages }: WikiGraphProps) {
  if (pages.length === 0) {
    return <p className={styles.empty}>暂时没有已发布的 Wiki 主题。</p>;
  }

  const columns = Math.min(3, pages.length);
  const rows = Math.ceil(pages.length / columns);
  const width = columns * 300 + 60;
  const height = rows * 142 + 44;
  const positions = new Map(pages.map((page, index) => [page.slug, {
    left: 30 + (index % columns) * 300,
    top: 22 + Math.floor(index / columns) * 142,
  }]));
  const edges = new Map<string, { from: { x: number; y: number }; to: { x: number; y: number } }>();

  for (const page of pages) {
    const from = positions.get(page.slug);
    if (!from) continue;
    for (const related of page.relatedPages) {
      const to = positions.get(related.slug);
      if (!to || related.slug === page.slug) continue;
      const key = [page.slug, related.slug].sort().join(":");
      edges.set(key, {
        from: { x: from.left + 110, y: from.top + 36 },
        to: { x: to.left + 110, y: to.top + 36 },
      });
    }
  }

  return (
    <div aria-label="已发布 Wiki 主题知识图谱" className={styles.graphScroll} role="group" tabIndex={0}>
      <div className={styles.graph} style={{ height, width }}>
        <svg aria-hidden="true" className={styles.edges} height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
          {Array.from(edges, ([key, edge]) => (
            <line key={key} x1={edge.from.x} x2={edge.to.x} y1={edge.from.y} y2={edge.to.y} />
          ))}
        </svg>
        {pages.map((page) => {
          const position = positions.get(page.slug);
          return position ? (
            <Link
              aria-label={`查看 Wiki 主题：${page.title}`}
              className={styles.node}
              href={`/wiki/${page.slug}`}
              key={page.slug}
              style={position}
            >
              <span className={styles.nodeMark} aria-hidden="true" />
              <span>{page.title}</span>
            </Link>
          ) : null;
        })}
      </div>
    </div>
  );
}
