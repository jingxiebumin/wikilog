import "server-only";
import { randomUUID } from "node:crypto";
import { appendFile, chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { AuthError } from "@/lib/auth/errors";

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ArticleImage = { name: string; contentType: string; bytes: Uint8Array };
export type StoredArticleImage = { key: string; name: string; contentType: string };

const MiB = 1024 * 1024;
const limit = (name: string, fallback: number, max: number): number => {
  const raw = process.env[name];
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 && value <= max ? value : fallback;
};

export function getArticleImageLimits() {
  return {
    maxCount: limit("ARTICLE_IMAGE_MAX_COUNT", 10, 50),
    maxBytes: limit("ARTICLE_IMAGE_MAX_BYTES", 5 * MiB, 25 * MiB),
    maxTotalBytes: limit("ARTICLE_IMAGE_MAX_TOTAL_BYTES", 25 * MiB, 100 * MiB),
  };
}

export function getArticleUploadMaxBytes(): number {
  return 1024 * 1024 + getArticleImageLimits().maxTotalBytes + 64 * 1024;
}

function storageDirectory(): string {
  const directory = process.env.ARTICLE_STORAGE_DIR?.trim();
  if (!directory || process.env.ARTICLE_STORAGE_VERIFIED !== "true") {
    throw new AuthError("STORAGE_UNAVAILABLE", "文章图片存储尚未完成持久性和备份验收。");
  }
  return path.resolve(directory);
}

function validateImage(image: ArticleImage): string {
  const extension = extensions[image.contentType];
  const bytes = Buffer.from(image.bytes);
  const { maxBytes } = getArticleImageLimits();
  if (!extension) throw new AuthError("INVALID_INPUT", "图片仅支持 JPEG、PNG 或 WebP。");
  if (path.extname(image.name).toLowerCase() !== `.${extension}`) {
    throw new AuthError("INVALID_INPUT", "图片文件扩展名与文件类型不匹配。");
  }
  if (bytes.length === 0 || bytes.length > maxBytes) {
    throw new AuthError("INVALID_INPUT", `图片仅支持 JPEG、PNG 或 WebP，单张不能超过 ${Math.ceil(maxBytes / MiB)} MB。`);
  }
  const valid = image.contentType === "image/jpeg"
    ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : image.contentType === "image/png"
      ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && !bytes.includes(Buffer.from("acTL"))
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" && !bytes.includes(Buffer.from("ANIM"));
  if (!valid) throw new AuthError("INVALID_INPUT", "图片内容与文件类型不匹配，或图片格式暂不支持。");
  return extension;
}

export function validateArticleImageLimits(images: ReadonlyArray<{ size: number }>): void {
  const limits = getArticleImageLimits();
  if (images.length > limits.maxCount) throw new AuthError("INVALID_INPUT", `每篇文章最多上传 ${limits.maxCount} 张图片。`);
  if (images.some((image) => image.size > limits.maxBytes)) {
    throw new AuthError("INVALID_INPUT", `图片仅支持 JPEG、PNG 或 WebP，单张不能超过 ${Math.ceil(limits.maxBytes / MiB)} MB。`);
  }
  if (images.reduce((total, image) => total + image.size, 0) > limits.maxTotalBytes) {
    throw new AuthError("INVALID_INPUT", `单次图片上传总量不能超过 ${Math.ceil(limits.maxTotalBytes / MiB)} MB。`);
  }
}

async function queueArticleImageCleanup(key: string, error: unknown): Promise<void> {
  const directory = storageDirectory();
  await appendFile(path.join(directory, ".pending-cleanup.jsonl"), `${JSON.stringify({ key, queuedAt: new Date().toISOString(), reason: error instanceof Error ? error.message : "unknown" })}\n`, { mode: 0o600 });
}

export async function removeOrQueueArticleImages(keys: string[]): Promise<void> {
  for (const key of keys) {
    try {
      await removeArticleImage(key);
    } catch (error) {
      try {
        await queueArticleImageCleanup(key, error);
      } catch (queueError) {
        console.error("Failed to remove or queue article image cleanup", { key, error, queueError });
      }
    }
  }
}

function safeImagePath(key: string): string {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key)) throw new AuthError("NOT_FOUND", "图片不存在。");
  return path.join(storageDirectory(), key);
}

export async function storeArticleImages(images: ArticleImage[]): Promise<StoredArticleImage[]> {
  validateArticleImageLimits(images.map(({ bytes }) => ({ size: bytes.byteLength })));
  const names = new Set<string>();
  const validated = images.map((image) => {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(image.name) || image.name === "." || image.name === "..") {
      throw new AuthError("INVALID_INPUT", "图片文件名只能包含英文、数字、点、下划线和连字符。");
    }
    if (names.has(image.name)) throw new AuthError("INVALID_INPUT", "本次上传不能包含重名图片。");
    names.add(image.name);
    return { image, extension: validateImage(image) };
  });
  const directory = storageDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const stored: StoredArticleImage[] = [];
  try {
    for (const { image, extension } of validated) {
      const key = `${randomUUID()}.${extension}`;
      stored.push({ key, name: image.name, contentType: image.contentType });
      await writeFile(path.join(/*turbopackIgnore: true*/ directory, key), image.bytes, { flag: "wx", mode: 0o600 });
    }
    return stored;
  } catch (error) {
    await removeOrQueueArticleImages(stored.map(({ key }) => key));
    throw error;
  }
}

export async function readArticleImage(key: string): Promise<{ bytes: Uint8Array; contentType: string } | undefined> {
  try {
    return { bytes: new Uint8Array(await readFile(safeImagePath(key))), contentType: key.endsWith(".jpg") ? "image/jpeg" : key.endsWith(".png") ? "image/png" : "image/webp" };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function removeArticleImage(key: string): Promise<void> {
  try { await unlink(safeImagePath(key)); }
  catch (error) {
    if (error instanceof AuthError) throw error;
    if (!(typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT")) throw error;
  }
}
