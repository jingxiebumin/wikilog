import { NextResponse } from "next/server";
import { adminResetReader, requireSession } from "@/lib/auth/service";
import { requestMeta } from "@/lib/auth/http";
import { authErrorResponse, readBody } from "@/lib/auth/route-utils";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readBody(request);
    const operator = await requireSession({ admin: true });
    const result = await adminResetReader({
      operator,
      targetUserId: id,
      reason: body.reason ?? "",
      identityConfirmed: body.identityConfirmed === "true" || body.identityConfirmed === "on",
      meta: requestMeta(request),
    });
    return NextResponse.json(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}
