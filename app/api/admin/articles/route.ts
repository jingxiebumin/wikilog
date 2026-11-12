import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { AuthError } from "@/lib/auth/errors";
import { adminArticleList, adminUploadArticle } from "@/lib/articles/service";
import { authErrorResponse } from "@/lib/auth/route-utils";

export async function GET() {
  try {
    const actor = await requireSession({ admin: true });
    return NextResponse.json({ articles: await adminArticleList(actor) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSession({ admin: true });
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > 1024 * 1024 + 16 * 1024) {
      throw new AuthError("INVALID_INPUT", "MDX 文件不能超过 1 MiB。");
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".mdx") || file.type && !["text/plain", "text/markdown", "application/octet-stream"].includes(file.type)) {
      throw new AuthError("INVALID_INPUT", "请选择 MDX 文件。");
    }
    if (file.size > 1024 * 1024) throw new AuthError("INVALID_INPUT", "MDX 文件不能超过 1 MB。");
    await adminUploadArticle(actor, await file.text());
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
