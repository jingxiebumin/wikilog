import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { adminErrorResponse } from "@/lib/auth/route-utils";
import { requestMeta } from "@/lib/auth/http";
import { publishAdminWikiPageVersion } from "@/lib/wiki/service";

export async function POST(request: Request, { params }: { params: Promise<{ pageId: string; versionId: string }> }) {
  try {
    const session = await requireSession({ admin: true });
    const { pageId, versionId } = await params;
    await publishAdminWikiPageVersion(session, pageId, versionId, requestMeta(request));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
