import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "文章版本发布流程已停用。" }, { status: 410 });
}
