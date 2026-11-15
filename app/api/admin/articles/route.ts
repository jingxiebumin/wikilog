import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { AuthError } from "@/lib/auth/errors";
import { adminArticleList, adminUploadArticle } from "@/lib/articles/service";
import { getArticleUploadMaxBytes, validateArticleImageLimits } from "@/lib/articles/image-storage";
import { adminErrorResponse } from "@/lib/auth/route-utils";

export async function GET() {
  try {
    const actor = await requireSession({ admin: true });
    return NextResponse.json({ articles: await adminArticleList(actor) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSession({ admin: true });
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > getArticleUploadMaxBytes()) {
      throw new AuthError("INVALID_INPUT", "MDX 与图片上传总量超过限制。");
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".mdx") || file.type && !["text/plain", "text/markdown", "application/octet-stream"].includes(file.type)) {
      throw new AuthError("INVALID_INPUT", "请选择 MDX 文件。");
    }
    if (file.size > 1024 * 1024) throw new AuthError("INVALID_INPUT", "MDX 文件不能超过 1 MB。");
    const imageFiles = form.getAll("images");
    if (imageFiles.some((entry) => !(entry instanceof File))) throw new AuthError("INVALID_INPUT", "图片上传内容无效。");
    const selectedImages = (imageFiles as File[]).filter((image) => image.size > 0);
    validateArticleImageLimits(selectedImages);
    const images = await Promise.all(selectedImages.map(async (image) => ({
      name: image.name,
      contentType: image.type,
      bytes: new Uint8Array(await image.arrayBuffer()),
    })));
    await adminUploadArticle(actor, await file.text(), images);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
