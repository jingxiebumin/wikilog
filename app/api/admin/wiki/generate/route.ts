import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { adminErrorResponse } from "@/lib/auth/route-utils";

export async function POST() {
  try {
    await requireSession({ admin: true });
    return NextResponse.json({ error: "Wiki AI 生成功能尚未确认开放。" }, { status: 503 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
