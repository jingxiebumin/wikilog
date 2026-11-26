import type { ReactNode } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { AdminWorkspaceNav } from "@/components/admin-workspace-nav";

type AdminLayoutProps = {
  active: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function AdminLayout({ active, title, description, children }: AdminLayoutProps) {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 items-start gap-6 px-6 py-8 md:grid-cols-[220px_1fr]">
      <GlassCard className="admin-layout-nav sticky top-24 p-3" variant="admin">
        <AdminWorkspaceNav active={active} />
      </GlassCard>
      <GlassCard className="admin-layout-content min-h-[520px] p-6 md:p-8" variant="admin">
        <header className="page-heading mb-6">
          <p className="eyebrow"><span className="eyebrow-mark" />管理员设置</p>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </header>
        {children}
      </GlassCard>
    </div>
  );
}
