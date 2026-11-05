"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page error-page" role="alert">
      <span className="empty-icon"><TriangleAlert aria-hidden="true" size={22} strokeWidth={1.7} /></span>
      <p className="eyebrow"><span className="eyebrow-mark" /> 暂时无法读取</p>
      <h1>内容暂时不可用</h1>
      <p>请稍后重试。如果问题持续，请联系站点维护者。</p>
      <button className="button-link" onClick={reset} type="button">
        <RefreshCw aria-hidden="true" size={15} />重新加载
      </button>
    </div>
  );
}
