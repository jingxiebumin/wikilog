import "server-only";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AuthError } from "./errors";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function storageDirectory(): string {
  const directory = process.env.AVATAR_STORAGE_DIR?.trim();
  if (!directory || process.env.AVATAR_STORAGE_VERIFIED !== "true") {
    throw new AuthError("STORAGE_UNAVAILABLE", "头像存储尚未完成持久性和备份验收。");
  }
  return path.resolve(directory);
}

function validateImage(bytes: Uint8Array, contentType: string): string {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_AVATAR_BYTES) {
    throw new AuthError("INVALID_INPUT", "头像文件必须小于或等于 5 MB。");
  }
  const extension = extensions[contentType];
  const buffer = Buffer.from(bytes);
  const isJpeg = contentType === "image/jpeg" && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = contentType === "image/png" && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && !buffer.includes(Buffer.from("acTL"));
  const isWebp = contentType === "image/webp" && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP" && !buffer.includes(Buffer.from("ANIM"));
  if (!extension || !(isJpeg || isPng || isWebp)) {
    throw new AuthError("INVALID_INPUT", "仅支持静态 JPEG、PNG 或 WebP 图片。");
  }
  return extension;
}

function safeAvatarPath(key: string): string {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key)) {
    throw new AuthError("NOT_FOUND", "头像不存在。");
  }
  return path.join(storageDirectory(), key);
}

export async function storeAvatar(bytes: Uint8Array, contentType: string): Promise<{ key: string; contentType: string }> {
  const extension = validateImage(bytes, contentType);
  const directory = storageDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const key = `${randomUUID()}.${extension}`;
  await writeFile(path.join(/*turbopackIgnore: true*/ directory, key), bytes, { flag: "wx", mode: 0o600 });
  return { key, contentType };
}

export async function readAvatar(key: string): Promise<{ bytes: Uint8Array; contentType: string } | undefined> {
  try {
    const bytes = await readFile(safeAvatarPath(key));
    const extension = key.slice(key.lastIndexOf(".") + 1);
    const contentType = extension === "jpg" ? "image/jpeg" : extension === "png" ? "image/png" : "image/webp";
    return { bytes: new Uint8Array(bytes), contentType };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function removeAvatar(key: string): Promise<void> {
  const filePath = safeAvatarPath(key);
  const { unlink } = await import("node:fs/promises");
  try {
    await unlink(filePath);
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT")) throw error;
  }
}
