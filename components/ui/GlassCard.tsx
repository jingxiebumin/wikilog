import type { HTMLAttributes, ReactNode } from "react";

type GlassCardProps = {
  variant?: "public" | "admin";
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "children">;

const variants = {
  public: "bg-white/75 backdrop-blur-xl border border-white/65 rounded-2xl shadow-sm",
  admin: "bg-white/88 backdrop-blur-xl border border-white/80 rounded-2xl shadow-sm",
};

export function GlassCard({ variant = "public", className = "", children, ...props }: GlassCardProps) {
  return <div className={`${variants[variant]} ${className}`.trim()} {...props}>{children}</div>;
}
