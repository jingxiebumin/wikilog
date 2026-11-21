import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const directories: string[] = [];
const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

async function storage() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "wikilog-avatars-"));
  directories.push(directory);
  vi.stubEnv("AVATAR_STORAGE_DIR", directory);
  vi.stubEnv("AVATAR_STORAGE_VERIFIED", "true");
  return import("./avatar-storage");
}

describe("private avatar storage", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it("stores and reads an allowed static image by an opaque key", async () => {
    const avatarStorage = await storage();
    const stored = await avatarStorage.storeAvatar(pngBytes, "image/png");
    expect(stored.key).toMatch(/^[0-9a-f-]+\.png$/);
    if (process.platform !== "win32") {
      expect((await stat(directories.at(-1)!)).mode & 0o777).toBe(0o700);
      expect((await stat(path.join(directories.at(-1)!, stored.key))).mode & 0o777).toBe(0o600);
    }
    await expect(avatarStorage.readAvatar(stored.key)).resolves.toMatchObject({ contentType: "image/png" });
    const image = await avatarStorage.readAvatar(stored.key);
    expect(image?.bytes).toEqual(pngBytes);
  });

  it("refuses to save when server persistence has not been verified", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "wikilog-avatars-"));
    directories.push(directory);
    vi.stubEnv("AVATAR_STORAGE_DIR", directory);
    vi.stubEnv("AVATAR_STORAGE_VERIFIED", "false");
    const avatarStorage = await import("./avatar-storage");
    await expect(avatarStorage.storeAvatar(pngBytes, "image/png")).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
      message: "头像服务器存储尚未完成验收。",
    });
  });

  it("rejects animated PNG content and unsupported image types", async () => {
    const avatarStorage = await storage();
    const animatedPng = new Uint8Array([...pngBytes, ...Buffer.from("acTL")]);
    await expect(avatarStorage.storeAvatar(animatedPng, "image/png")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(avatarStorage.storeAvatar(pngBytes, "image/gif")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
