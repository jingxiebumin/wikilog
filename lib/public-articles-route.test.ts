import { beforeEach, describe, expect, it, vi } from "vitest";

const publicContent = vi.hoisted(() => ({ listPublishedArticlePage: vi.fn() }));

vi.mock("@/lib/public-content", () => publicContent);

import { GET } from "@/app/api/articles/route";

describe("public article pagination route", () => {
  beforeEach(() => publicContent.listPublishedArticlePage.mockReset());

  it("returns a category page and whether more published articles are available", async () => {
    publicContent.listPublishedArticlePage.mockResolvedValue({ articles: [{ slug: "one" }], totalCount: 2 });

    const response = await GET(new Request("http://localhost/api/articles?category=engineering&limit=1&offset=1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ articles: [{ slug: "one" }], totalCount: 2, hasMore: false });
    expect(publicContent.listPublishedArticlePage).toHaveBeenCalledWith("engineering", 1, 1);
  });

  it("rejects malformed pagination parameters", async () => {
    const response = await GET(new Request("http://localhost/api/articles?limit=abc&offset=0"));

    expect(response.status).toBe(400);
    expect(publicContent.listPublishedArticlePage).not.toHaveBeenCalled();
  });
});
