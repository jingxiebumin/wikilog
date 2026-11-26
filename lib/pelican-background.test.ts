import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesheetPath = fileURLToPath(new URL("../app/styles/pelican-background.module.css", import.meta.url));

describe("PelicanBackground stacking contract", () => {
  it("keeps the fixed decoration above the document background", async () => {
    const stylesheet = await readFile(stylesheetPath, "utf8");
    const fixedRule = stylesheet.match(/\.fixed\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    const zIndex = fixedRule.match(/z-index:\s*(-?\d+)/)?.[1];

    expect(zIndex).toBeDefined();
    expect(Number(zIndex)).toBeGreaterThanOrEqual(0);
  });
});
