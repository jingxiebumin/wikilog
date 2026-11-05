import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export function EmptyState({ title, message, backHref = "/", backLabel = "返回首页" }: {
  title: string;
  message: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><SearchX aria-hidden="true" size={22} strokeWidth={1.7} /></span>
      <h2>{title}</h2>
      <p>{message}</p>
      <Link className="button-link" href={backHref}>
        <ArrowLeft aria-hidden="true" size={16} />{backLabel}
      </Link>
    </div>
  );
}
