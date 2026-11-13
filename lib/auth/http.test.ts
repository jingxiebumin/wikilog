import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { clearSessionCookie, setSessionCookie } from "./http";
import { SESSION_COOKIE } from "./service";

describe("session cookie transport", () => {
  it.each([
    { scheme: "http", secure: false },
    { scheme: "https", secure: true },
  ])("sets Secure according to the request scheme ($scheme)", ({ scheme, secure }) => {
    const request = new Request(`${scheme}://blog.example.test/api/auth/login`);
    const response = setSessionCookie(NextResponse.json({ ok: true }), "token", request);
    const cookie = response.cookies.get(SESSION_COOKIE);

    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(secure);
  });

  it.each([
    { scheme: "http", secure: false },
    { scheme: "https", secure: true },
  ])("clears Secure according to the request scheme ($scheme)", ({ scheme, secure }) => {
    const request = new Request(`${scheme}://blog.example.test/api/auth/logout`);
    const response = clearSessionCookie(NextResponse.json({ ok: true }), request);
    const cookie = response.cookies.get(SESSION_COOKIE);

    expect(cookie?.maxAge).toBe(0);
    expect(cookie?.secure).toBe(secure);
  });
});
