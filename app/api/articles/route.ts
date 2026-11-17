import { NextResponse } from "next/server";
import { listPublishedArticlePage } from "@/lib/public-content";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category") ?? "all";
  const limitValue = url.searchParams.get("limit") ?? "10";
  const offsetValue = url.searchParams.get("offset") ?? "0";
  const limit = Number(limitValue);
  const offset = Number(offsetValue);
  if (!Number.isInteger(limit) || !Number.isInteger(offset) || limit < 1 || offset < 0) {
    return NextResponse.json({ error: "分页参数无效。" }, { status: 400 });
  }
  const page = await listPublishedArticlePage(category, limit, offset);
  return NextResponse.json({ ...page, hasMore: offset + page.articles.length < page.totalCount });
}
