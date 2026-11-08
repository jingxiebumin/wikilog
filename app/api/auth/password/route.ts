import { NextResponse } from "next/server";
import { changePassword, requireSession } from "@/lib/auth/service";
import { authErrorResponse, readBody } from "@/lib/auth/route-utils";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const session = await requireSession({ allowPasswordReset: true });
    await changePassword({
      userId: session.id,
      currentPassword: body.currentPassword ?? "",
      password: body.password ?? "",
      confirmation: body.confirmation ?? body.confirmPassword ?? "",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
