import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { adminErrorResponse } from "@/lib/auth/route-utils";
import { requestMeta } from "@/lib/auth/http";
import { listAdminWikiPages, saveAdminWikiPageDraft } from "@/lib/wiki/service";
import { parseWikiDraftInput, readWikiJson } from "@/lib/wiki/http-input";

export async function GET() {
  try {
    const session = await requireSession({ admin: true });
    return NextResponse.json({ pages: await listAdminWikiPages(session) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession({ admin: true });
    const body = await readWikiJson(request);
    const input = parseWikiDraftInput(body);
    const draft = await saveAdminWikiPageDraft(session, input, requestMeta(request));
    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
