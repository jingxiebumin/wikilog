export function getArticleSummaryLine(summary: string, maxLength = 120): string {
  const normalized = summary.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 1))}…`;
}

export function getArticleCoverPath(cover: string): string {
  return `/covers/${cover}.svg`;
}

export function getTaxonomyDisplayNames(slugs: string[], options: Array<{ slug: string; name: string }>): string {
  const names = new Map(options.map(({ slug, name }) => [slug, name]));
  return slugs.map((slug) => names.get(slug) ?? slug).join("、");
}
