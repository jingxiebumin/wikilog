import { NextResponse } from "next/server";
import { readAvatar, removeAvatar, storeAvatar } from "@/lib/auth/avatar-storage";
import { getOwnProfile, requireSession, updateOwnAvatar } from "@/lib/auth/service";
import { AuthError } from "@/lib/auth/errors";
import { authErrorResponse } from "@/lib/auth/route-utils";

export async function GET() {
  try {
    const session = await requireSession();
    const profile = await getOwnProfile(session.id);
    if (!profile.avatarKey) return NextResponse.json({ error: "头像不存在。" }, { status: 404 });
    const image = await readAvatar(profile.avatarKey);
    if (!image) return NextResponse.json({ error: "头像不存在。" }, { status: 404 });
    const body = new ArrayBuffer(image.bytes.byteLength);
    new Uint8Array(body).set(image.bytes);
    return new Response(body, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let newKey: string | undefined;
  try {
    const session = await requireSession();
    const form = await request.formData();
    const file = form.get("avatar");
    if (!(file instanceof File)) throw new AuthError("INVALID_INPUT", "请选择头像图片。");
    if (file.size > 5 * 1024 * 1024) throw new AuthError("INVALID_INPUT", "头像文件不能超过 5 MB。");
    const current = await getOwnProfile(session.id);
    const stored = await storeAvatar(new Uint8Array(await file.arrayBuffer()), file.type);
    newKey = stored.key;
    await updateOwnAvatar(session.id, stored.key);
    if (current.avatarKey) await removeAvatar(current.avatarKey).catch(() => undefined);
    return NextResponse.json({ avatarKey: stored.key });
  } catch (error) {
    if (newKey) await removeAvatar(newKey).catch(() => undefined);
    return authErrorResponse(error);
  }
}
