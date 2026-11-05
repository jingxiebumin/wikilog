import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <div className="page not-found-page">
      <p className="eyebrow"><span className="eyebrow-mark" /> 404 / NOT FOUND</p>
      <EmptyState title="这篇记录暂时找不到" message="它可能已经移动，或暂时不在公开列表中。" />
    </div>
  );
}
