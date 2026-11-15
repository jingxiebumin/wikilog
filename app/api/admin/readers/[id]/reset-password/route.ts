import { NextResponse } from "next/server";
import { adminResetReader, requireSession } from "@/lib/auth/service";
import { requestMeta } from "@/lib/auth/http";
import { adminErrorResponse } from "@/lib/auth/route-utils";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const operator = await requireSession({ admin: true });
    await adminResetReader({
      operator,
      targetUserId: id,
      meta: requestMeta(request),
    });
    return NextResponse.json({ ok: true, message: "密码已重置为 123456。该读者下次登录时必须修改密码。" });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
