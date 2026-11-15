import { NextResponse } from "next/server";
import { changePassword, requireSession } from "@/lib/auth/service";
import { authErrorResponse, readBody, redirectWithError } from "@/lib/auth/route-utils";
import { setSessionCookie } from "@/lib/auth/http";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const session = await requireSession({ allowPasswordReset: true });
    const result = await changePassword({
      userId: session.id,
      sessionId: session.sessionId,
      displayName: body.displayName ?? "",
      currentPassword: body.currentPassword ?? "",
      password: body.password ?? "",
      confirmation: body.confirmation ?? body.confirmPassword ?? "",
    });
    const response = request.headers.get("accept")?.includes("text/html")
      ? NextResponse.redirect(new URL("/account", request.url), 303)
      : NextResponse.json({ ok: true });
    return result.rotatedSession ? setSessionCookie(response, result.rotatedSession.token, request) : response;
  } catch (error) {
    return request.headers.get("accept")?.includes("text/html")
      ? redirectWithError(request, error, "/account/password")
      : authErrorResponse(error);
  }
}
