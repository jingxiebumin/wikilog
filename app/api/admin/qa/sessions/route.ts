import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { adminErrorResponse, readBody } from "@/lib/auth/route-utils";
import { askAdminQaQuestion, listAdminQaSessions } from "@/lib/qa";

export async function GET() {
  try {
    const session = await requireSession({ admin: true });
    return NextResponse.json({ sessions: await listAdminQaSessions(session) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession({ admin: true });
    const body = await readBody(request);
    const answer = await askAdminQaQuestion(session, {
      question: body.question ?? "",
      modelId: body.modelId,
    });
    return NextResponse.json(answer, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
