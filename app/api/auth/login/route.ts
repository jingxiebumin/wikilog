import { NextResponse } from "next/server";
import { login } from "@/lib/auth/service";
import { requestMeta, setSessionCookie } from "@/lib/auth/http";
import { authErrorResponse, readBody, redirectWithError } from "@/lib/auth/route-utils";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const result = await login({ email: body.email ?? "", password: body.password ?? "", meta: requestMeta(request) });
    const destination = result.user.passwordResetRequired ? "/account/password" : "/account";
    const response = request.headers.get("accept")?.includes("text/html")
      ? NextResponse.redirect(new URL(destination, request.url), 303)
      : NextResponse.json({ user: result.user });
    return setSessionCookie(response, result.token, request);
  } catch (error) {
    return request.headers.get("accept")?.includes("text/html")
      ? redirectWithError(request, error, "/login")
      : authErrorResponse(error);
  }
}
