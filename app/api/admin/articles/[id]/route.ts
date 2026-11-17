import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { adminCurrentArticle } from "@/lib/articles/service";
import { adminErrorResponse } from "@/lib/auth/route-utils";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSession({ admin: true });
    const { id } = await context.params;
    const article = await adminCurrentArticle(actor, id);
    return article ? NextResponse.json({ article }) : NextResponse.json({ error: "Not found." }, { status: 404 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
