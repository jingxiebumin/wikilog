import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "此功能暂不可用。" }, { status: 404 });
}
