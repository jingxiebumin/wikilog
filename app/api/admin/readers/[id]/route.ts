import { NextResponse } from "next/server";
import { adminEditReader, adminSoftDeleteReader, requireSession } from "@/lib/auth/service";
import { requestMeta } from "@/lib/auth/http";
import { adminErrorResponse, readBody } from "@/lib/auth/route-utils";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const operator = await requireSession({ admin: true });
    const body = await readBody(request);
    const user = await adminEditReader({
      operator,
      targetUserId: id,
      displayName: body.displayName ?? "",
      email: body.email ?? "",
      phone: body.phone ?? "",
      gender: body.gender ?? "",
      meta: requestMeta(request),
    });
    return NextResponse.json({ user });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const operator = await requireSession({ admin: true });
    const body = await readBody(request);
    await adminSoftDeleteReader({ operator, targetUserId: id, reason: body.reason ?? "", meta: requestMeta(request) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
