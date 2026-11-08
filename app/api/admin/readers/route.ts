import { NextResponse } from "next/server";
import { adminCreateReader, requireSession } from "@/lib/auth/service";
import { authErrorResponse, readBody } from "@/lib/auth/route-utils";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const operator = await requireSession({ admin: true });
    const user = await adminCreateReader({
      operator,
      displayName: body.displayName ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
