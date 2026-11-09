import { NextResponse } from "next/server";
import { changePassword, requireSession } from "@/lib/auth/service";
import { authErrorResponse, readBody, redirectWithError } from "@/lib/auth/route-utils";

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
    return request.headers.get("accept")?.includes("text/html")
      ? NextResponse.redirect(new URL("/account", request.url), 303)
      : NextResponse.json({ ok: true });
  } catch (error) {
    return request.headers.get("accept")?.includes("text/html")
      ? redirectWithError(request, error, "/account/password")
      : authErrorResponse(error);
  }
}
