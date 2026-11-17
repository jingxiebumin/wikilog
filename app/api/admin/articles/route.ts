import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { AuthError } from "@/lib/auth/errors";
import { adminCurrentArticleList, adminSaveCurrentArticle } from "@/lib/articles/service";
import { adminErrorResponse } from "@/lib/auth/route-utils";

export async function GET(request: Request) {
  try {
    const actor = await requireSession({ admin: true });
    const params = new URL(request.url).searchParams;
    return NextResponse.json(await adminCurrentArticleList(actor, {
      category: params.get("category") || undefined,
      status: (params.get("status") === "visible" || params.get("status") === "hidden") ? params.get("status") as "visible" | "hidden" : undefined,
      search: params.get("search") || undefined,
      page: Number(params.get("page") || 1),
      pageSize: Number(params.get("pageSize") || 10),
    }));
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSession({ admin: true });
    const form = await request.formData();
    const file = form.get("file");
    if (file && (!(file instanceof File) || !file.name.toLowerCase().endsWith(".md") || file.type && !["text/plain", "text/markdown", "application/octet-stream"].includes(file.type))) {
      throw new AuthError("INVALID_INPUT", "请选择 Markdown（.md）文件。");
    }
    if (file instanceof File && file.size > 1024 * 1024) throw new AuthError("INVALID_INPUT", "Markdown 文件不能超过 1 MB。");
    const tags = form.getAll("tags").map(String);
    const id = String(form.get("id") ?? "") || undefined;
    const articleId = await adminSaveCurrentArticle(actor, {
      id, title: String(form.get("title") ?? ""), summary: String(form.get("summary") ?? ""),
      category: String(form.get("category") ?? ""), tags, publishedAt: String(form.get("publishedAt") ?? ""),
      source: file instanceof File && file.size ? await file.text() : undefined, sourceFilename: file instanceof File && file.size ? file.name : undefined,
    });
    return NextResponse.json({ id: articleId }, { status: id ? 200 : 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
