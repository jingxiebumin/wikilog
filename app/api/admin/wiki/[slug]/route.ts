import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { adminErrorResponse } from "@/lib/auth/route-utils";
import { getAdminWikiPageHistory, saveAdminWikiPageDraft } from "@/lib/wiki/service";
import { parseWikiDraftInput, readWikiJson } from "@/lib/wiki/http-input";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await requireSession({ admin: true });
    const { slug } = await params;
    return NextResponse.json({ versions: await getAdminWikiPageHistory(session, slug) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await requireSession({ admin: true });
    const { slug } = await params;
    const body = await readWikiJson(request);
    const input = parseWikiDraftInput(body, slug);
    const draft = await saveAdminWikiPageDraft(session, input);
    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
