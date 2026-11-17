import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { adminCurrentArticle } from "@/lib/articles/service";
import { adminErrorResponse } from "@/lib/auth/route-utils";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSession({ admin: true });
    const { id } = await context.params;
    const article = await adminCurrentArticle(actor, id);
    if (!article) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return new Response(article.sourceMdx, { headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(article.sourceFilename || `${article.id}.md`)}`,
      "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
