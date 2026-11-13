import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/auth/types";

const repository = vi.hoisted(() => ({
  addFavorite: vi.fn(),
  hasFavorite: vi.fn(),
  listFavoritesForUser: vi.fn(),
  removeFavorite: vi.fn(),
}));

vi.mock("./repository", () => repository);

describe("favorite access", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    repository.addFavorite.mockResolvedValue(true);
    repository.hasFavorite.mockResolvedValue(false);
    repository.listFavoritesForUser.mockResolvedValue([]);
    repository.removeFavorite.mockResolvedValue(undefined);
  });

  it.each(["reader", "admin"] as const)("allows an active %s to manage their own favorites", async (role) => {
    const favorites = await import("./service");
    const session = {
      id: `${role}-id`,
      role,
      status: "active",
      passwordResetRequired: false,
    } as Session;

    await favorites.readerFavorites(session);
    await favorites.readerHasFavorite(session, "article-one");
    await favorites.readerAddFavorite(session, "article-one");
    await favorites.readerRemoveFavorite(session, "article-one");

    expect(repository.listFavoritesForUser).toHaveBeenCalledWith(`${role}-id`);
    expect(repository.addFavorite).toHaveBeenCalledWith(`${role}-id`, "article-one");
    expect(repository.removeFavorite).toHaveBeenCalledWith(`${role}-id`, "article-one");
  });

  it("rejects disabled users and users who must change a temporary password", async () => {
    const favorites = await import("./service");
    const disabled = { role: "admin", status: "disabled", passwordResetRequired: false } as Session;
    const resetRequired = { role: "admin", status: "active", passwordResetRequired: true } as Session;

    await expect(favorites.readerFavorites(disabled)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(favorites.readerAddFavorite(resetRequired, "article-one")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repository.listFavoritesForUser).not.toHaveBeenCalled();
    expect(repository.addFavorite).not.toHaveBeenCalled();
  });
});
