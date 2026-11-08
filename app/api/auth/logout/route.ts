import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/http";
import { logoutCurrentSession } from "@/lib/auth/service";

export async function POST(request: Request) {
  await logoutCurrentSession();
  const response = request.headers.get("accept")?.includes("text/html")
    ? NextResponse.redirect(new URL("/", request.url), 303)
    : NextResponse.json({ ok: true });
  return clearSessionCookie(response);
}
