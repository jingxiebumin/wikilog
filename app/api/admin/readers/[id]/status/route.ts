import { NextResponse } from "next/server";
import { adminSetReaderStatus, requireSession } from "@/lib/auth/service";
import { requestMeta } from "@/lib/auth/http";
import { AuthError } from "@/lib/auth/errors";
import { authErrorResponse, readBody } from "@/lib/auth/route-utils";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await readBody(request);
    if (body.status !== "active" && body.status !== "disabled") {
      throw new AuthError("INVALID_INPUT", "无效的账号状态。");
    }
    const { id } = await context.params;
    const operator = await requireSession({ admin: true });
    await adminSetReaderStatus({ operator, targetUserId: id, status: body.status, reason: body.reason ?? "", meta: requestMeta(request) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
