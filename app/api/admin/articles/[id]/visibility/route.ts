import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { AuthError } from "@/lib/auth/errors";
import { adminChangeArticleVisibility } from "@/lib/articles/service";
import { adminErrorResponse } from "@/lib/auth/route-utils";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSession({ admin: true });
    const body = await request.json() as { action?: string; confirmed?: boolean };
    if ((body.action !== "hide" && body.action !== "delete" && body.action !== "restore") || body.confirmed !== true) {
      throw new AuthError("INVALID_INPUT", "无效的文章操作。");
    }
    const { id } = await context.params;
    await adminChangeArticleVisibility(actor, id, body.action);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
