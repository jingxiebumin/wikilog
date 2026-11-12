import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { AuthError } from "@/lib/auth/errors";
import { adminChangeArticleVisibility } from "@/lib/articles/service";
import { authErrorResponse } from "@/lib/auth/route-utils";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const actor = await requireSession({ admin: true });
    const body = await request.json() as { action?: string };
    if (body.action !== "hide" && body.action !== "delete" && body.action !== "restore") {
      throw new AuthError("INVALID_INPUT", "无效的文章操作。");
    }
    const { slug } = await context.params;
    await adminChangeArticleVisibility(actor, slug, body.action);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
