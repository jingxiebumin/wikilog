import { NextResponse } from "next/server";
import { adminCreateReader, adminListReaders, requireSession } from "@/lib/auth/service";
import { adminErrorResponse, readBody } from "@/lib/auth/route-utils";
import { requestMeta } from "@/lib/auth/http";

export async function GET(request: Request) {
  try {
    const operator = await requireSession({ admin: true });
    const params = new URL(request.url).searchParams;
    const readers = await adminListReaders(operator, {
      includeDeleted: params.get("status") === "deleted",
      search: params.get("search") ?? "",
    });
    return NextResponse.json({ readers });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const operator = await requireSession({ admin: true });
    const body = await readBody(request);
    const user = await adminCreateReader({
      operator,
      email: body.email ?? "",
      meta: requestMeta(request),
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
