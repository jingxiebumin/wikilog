import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { adminErrorResponse } from "@/lib/auth/route-utils";
import { getAdminQaSettings } from "@/lib/qa";

export async function GET() {
  try {
    await requireSession({ admin: true });
    return NextResponse.json(getAdminQaSettings());
  } catch (error) {
    return adminErrorResponse(error);
  }
}
