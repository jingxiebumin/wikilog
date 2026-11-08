import { NextResponse } from "next/server";
import { changeEmail, requireSession } from "@/lib/auth/service";
import { authErrorResponse, readBody } from "@/lib/auth/route-utils";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const session = await requireSession();
    const user = await changeEmail({ userId: session.id, currentPassword: body.currentPassword ?? "", email: body.email ?? "" });
    return NextResponse.json({ user });
  } catch (error) {
    return authErrorResponse(error);
  }
}
