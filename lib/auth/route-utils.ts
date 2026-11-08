import "server-only";
import { NextResponse } from "next/server";
import { AuthError, publicAuthMessage } from "./errors";

export async function readBody(request: Request): Promise<Record<string, string>> {
  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = await request.json() as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) return {};
    return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, typeof value === "string" ? value : String(value ?? "")]));
  }
  const form = await request.formData();
  return Object.fromEntries([...form.entries()].map(([key, value]) => [key, typeof value === "string" ? value : ""]));
}

export function authErrorResponse(error: unknown): NextResponse {
  const authError = error instanceof AuthError ? error : undefined;
  const status = authError?.code === "UNAUTHENTICATED" ? 401
    : authError?.code === "FORBIDDEN" ? 403
      : authError?.code === "RATE_LIMITED" ? 429
        : authError?.code === "CONFLICT" ? 409
          : authError?.code === "DATABASE_UNAVAILABLE" ? 503
            : authError?.code === "NOT_FOUND" ? 404 : 400;
  const response = NextResponse.json({ error: publicAuthMessage(error) }, { status });
  if (authError?.retryAfterSeconds) response.headers.set("Retry-After", String(authError.retryAfterSeconds));
  return response;
}

export function redirectWithError(request: Request, error: unknown, fallback: string): NextResponse {
  const location = new URL(fallback, request.url);
  location.searchParams.set("error", publicAuthMessage(error));
  return NextResponse.redirect(location, 303);
}
