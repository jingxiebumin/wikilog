import { NextResponse } from "next/server";
import { deleteAccount, requireSession } from "@/lib/auth/service";
import { authErrorResponse, readBody } from "@/lib/auth/route-utils";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const session = await requireSession();
    await deleteAccount({ userId: session.id, role: session.role, currentPassword: body.currentPassword ?? "", confirmation: body.confirmation ?? "" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
