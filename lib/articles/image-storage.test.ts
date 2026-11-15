import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalDirectory = process.env.ARTICLE_STORAGE_DIR;
const originalVerified = process.env.ARTICLE_STORAGE_VERIFIED;
let directory: string | undefined;

afterEach(async () => {
  vi.unstubAllEnvs();
  if (originalDirectory === undefined) delete process.env.ARTICLE_STORAGE_DIR;
  else process.env.ARTICLE_STORAGE_DIR = originalDirectory;
  if (originalVerified === undefined) delete process.env.ARTICLE_STORAGE_VERIFIED;
  else process.env.ARTICLE_STORAGE_VERIFIED = originalVerified;
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

async function configureStorage() {
  directory = await mkdtemp(path.join(os.tmpdir(), "wikilog-article-images-"));
  vi.stubEnv("ARTICLE_STORAGE_DIR", directory);
  vi.stubEnv("ARTICLE_STORAGE_VERIFIED", "true");
}

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

describe("article image storage", () => {
  it("requires a verified directory before storing images", async () => {
    const { storeArticleImages } = await import("./image-storage");
    await expect(storeArticleImages([{ name: "chart.png", contentType: "image/png", bytes: png }]))
      .rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE" });
  });

  it("validates signature and path-safe names, then stores private files", async () => {
    await configureStorage();
    const { storeArticleImages, readArticleImage } = await import("./image-storage");
    await expect(storeArticleImages([{ name: "../../secret.png", contentType: "image/png", bytes: png }]))
      .rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(storeArticleImages([{ name: "chart.jpg", contentType: "image/png", bytes: png }]))
      .rejects.toThrow("扩展名与文件类型不匹配");
    await expect(storeArticleImages([{ name: "fake.png", contentType: "image/png", bytes: new Uint8Array([1, 2, 3]) }]))
      .rejects.toMatchObject({ code: "INVALID_INPUT" });

    const [stored] = await storeArticleImages([{ name: "chart.png", contentType: "image/png", bytes: png }]);
    expect(stored.key).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(await readFile(path.join(directory!, stored.key))).toEqual(Buffer.from(png));
    expect(await readArticleImage(stored.key)).toMatchObject({ contentType: "image/png" });
  });

  it("enforces upload count, total size and duplicate-name limits", async () => {
    await configureStorage();
    const { storeArticleImages } = await import("./image-storage");
    const base = { name: "same.png", contentType: "image/png", bytes: png };
    await expect(storeArticleImages([base, base])).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(storeArticleImages(Array.from({ length: 11 }, (_, index) => ({ ...base, name: `${index}.png` }))))
      .rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(storeArticleImages([{ ...base, bytes: new Uint8Array(5 * 1024 * 1024 + 1) }]))
      .rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("uses bounded environment overrides for count, per-image and total byte limits", async () => {
    await configureStorage();
    vi.stubEnv("ARTICLE_IMAGE_MAX_COUNT", "1");
    vi.stubEnv("ARTICLE_IMAGE_MAX_BYTES", "10");
    vi.stubEnv("ARTICLE_IMAGE_MAX_TOTAL_BYTES", "12");
    const { getArticleImageLimits, storeArticleImages } = await import("./image-storage");
    expect(getArticleImageLimits()).toEqual({ maxCount: 1, maxBytes: 10, maxTotalBytes: 12 });
    await expect(storeArticleImages([{ name: "chart.png", contentType: "image/png", bytes: png }]))
      .rejects.toMatchObject({ code: "INVALID_INPUT" });

    vi.stubEnv("ARTICLE_IMAGE_MAX_COUNT", "1000");
    expect(getArticleImageLimits().maxCount).toBe(10);
  });
});
