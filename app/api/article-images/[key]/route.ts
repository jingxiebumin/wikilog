import { NextResponse } from "next/server";
import { readArticleImage } from "@/lib/articles/image-storage";
import { canReadArticleImage } from "@/lib/articles/service";
import { getCurrentSession } from "@/lib/auth/service";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params;
    const session = await getCurrentSession();
    const isAdmin = session?.role === "admin" && session.status === "active" && !session.passwordResetRequired;
    if (!await canReadArticleImage(key, Boolean(isAdmin))) return NextResponse.json({ error: "图片不存在。" }, { status: 404 });
    const image = await readArticleImage(key);
    if (!image) return NextResponse.json({ error: "图片不存在。" }, { status: 404 });
    const body = new ArrayBuffer(image.bytes.byteLength);
    new Uint8Array(body).set(image.bytes);
    return new Response(body, { headers: {
      "Content-Type": image.contentType,
      "Cache-Control": isAdmin ? "private, no-store" : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return NextResponse.json({ error: "图片暂时无法读取。" }, { status: 503 });
  }
}
