import { NextResponse } from "next/server";
import { registerReader } from "@/lib/auth/service";
import { requestMeta, setSessionCookie } from "@/lib/auth/http";
import { authErrorResponse, readBody, redirectWithError } from "@/lib/auth/route-utils";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const result = await registerReader({
      displayName: body.displayName ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
      confirmation: body.confirmation ?? body.confirmPassword ?? "",
      meta: requestMeta(request),
    });
    const response = request.headers.get("accept")?.includes("text/html")
      ? NextResponse.redirect(new URL("/account", request.url), 303)
      : NextResponse.json({ user: result.user });
    return setSessionCookie(response, result.token);
  } catch (error) {
    return request.headers.get("accept")?.includes("text/html")
      ? redirectWithError(request, error, "/register")
      : authErrorResponse(error);
  }
}
