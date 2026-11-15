import { redirect, notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/service";
import { AuthError } from "@/lib/auth/errors";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  try {
    await requireSession({ admin: true });
  } catch (error) {
    if (error instanceof AuthError && (error.code === "UNAUTHENTICATED" || error.code === "FORBIDDEN")) notFound();
    redirect("/login");
  }
  redirect("/admin/readers");
}
