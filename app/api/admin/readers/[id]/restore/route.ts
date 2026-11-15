import { NextResponse } from "next/server";
import { adminRestoreReader, requireSession } from "@/lib/auth/service";
import { requestMeta } from "@/lib/auth/http";
import { adminErrorResponse } from "@/lib/auth/route-utils";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const operator = await requireSession({ admin: true });
    await adminRestoreReader({ operator, targetUserId: id, meta: requestMeta(request) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
