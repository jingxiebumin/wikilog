import { NextResponse } from "next/server";
import { adminDisableReader, requireSession } from "@/lib/auth/service";
import { authErrorResponse } from "@/lib/auth/route-utils";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const operator = await requireSession({ admin: true });
    await adminDisableReader({ operator, targetUserId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
