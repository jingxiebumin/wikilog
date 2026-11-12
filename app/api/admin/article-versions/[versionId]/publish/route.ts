import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { adminPublishArticle } from "@/lib/articles/service";
import { authErrorResponse } from "@/lib/auth/route-utils";

export async function POST(_request: Request, context: { params: Promise<{ versionId: string }> }) {
  try {
    const actor = await requireSession({ admin: true });
    const { versionId } = await context.params;
    await adminPublishArticle(actor, versionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
