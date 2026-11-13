import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "./service";
import type { RequestMeta } from "./types";

export function requestMeta(request: Request): RequestMeta {
  return {
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown",
  };
}

const isHttpsRequest = (request: Request): boolean => new URL(request.url).protocol === "https:";

export function setSessionCookie(response: NextResponse, token: string, request: Request): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: isHttpsRequest(request),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse, request: Request): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isHttpsRequest(request),
    path: "/",
    maxAge: 0,
  });
  return response;
}

export function isValidUserId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
