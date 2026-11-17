import { describe, expect, it } from "vitest";
import { getArticleCoverPath, getArticleSummaryLine, getTaxonomyDisplayNames } from "@/lib/public-presentation";

describe("public article presentation", () => {
  it("keeps a summary on one line and truncates long text", () => {
    expect(getArticleSummaryLine("第一段\n第二段", 20)).toBe("第一段 第二段");
    expect(getArticleSummaryLine("abcdefghijklmnopqrstuvwxyz", 10)).toBe("abcdefghi…");
  });

  it("uses the saved cover image for the public article row", () => {
    expect(getArticleCoverPath("database")).toBe("/covers/database.svg");
  });

  it("renders managed taxonomy names while retaining unknown identifiers", () => {
    expect(getTaxonomyDisplayNames(["db", "legacy"], [{ slug: "db", name: "数据库" }])).toBe("数据库、legacy");
  });
});
