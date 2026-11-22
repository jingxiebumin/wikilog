import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { adminErrorResponse } from "@/lib/auth/route-utils";
import { requestMeta } from "@/lib/auth/http";
import { mergeAdminWikiPages } from "@/lib/wiki/service";
import { parseWikiMergeInput, readWikiJson } from "@/lib/wiki/http-input";

export async function POST(request: Request) {
  try {
    const session = await requireSession({ admin: true });
    const { sourceSlug, targetSlug } = parseWikiMergeInput(await readWikiJson(request));
    const draft = await mergeAdminWikiPages(session, sourceSlug, targetSlug, requestMeta(request));
    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
