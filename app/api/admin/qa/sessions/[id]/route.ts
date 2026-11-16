import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { adminErrorResponse } from "@/lib/auth/route-utils";
import { deleteAdminQaSession, getAdminQaSession } from "@/lib/qa";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireSession({ admin: true });
    const { id } = await context.params;
    return NextResponse.json({ session: await getAdminQaSession(session, id) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireSession({ admin: true });
    const { id } = await context.params;
    await deleteAdminQaSession(session, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
