import { NextResponse } from "next/server";
import { adminEditReader, requireSession } from "@/lib/auth/service";
import { requestMeta } from "@/lib/auth/http";
import { authErrorResponse, readBody } from "@/lib/auth/route-utils";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await readBody(request);
    const { id } = await context.params;
    const operator = await requireSession({ admin: true });
    const user = await adminEditReader({
      operator,
      targetUserId: id,
      displayName: body.displayName ?? "",
      email: body.email ?? "",
      reason: body.reason ?? "",
      meta: requestMeta(request),
    });
    return NextResponse.json({ user });
  } catch (error) {
    return authErrorResponse(error);
  }
}
