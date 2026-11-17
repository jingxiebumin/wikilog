"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > 240);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <button
      aria-label="回到顶部"
      className={`back-to-top${visible ? " is-visible" : ""}`}
      disabled={!visible}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      title="回到顶部"
      type="button"
    >
      <ArrowUp aria-hidden="true" size={17} />
    </button>
  );
}
