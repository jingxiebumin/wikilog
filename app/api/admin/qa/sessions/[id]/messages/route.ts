import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { readBody, adminErrorResponse } from "@/lib/auth/route-utils";
import { askAdminQaQuestion } from "@/lib/qa";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireSession({ admin: true });
    const [{ id }, body] = await Promise.all([context.params, readBody(request)]);
    const answer = await askAdminQaQuestion(session, {
      sessionId: id,
      question: body.question ?? "",
      modelId: body.modelId,
    });
    return NextResponse.json(answer, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
