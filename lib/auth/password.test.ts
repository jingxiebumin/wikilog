import { describe, expect, it } from "vitest";
import { generateTemporaryPassword, hashPassword, verifyPassword } from "./password";
import { normalizeEmail, validatePassword } from "./validation";

describe("password account primitives", () => {
  it("hashes passwords with a salted scrypt hash and verifies them", async () => {
    const first = await hashPassword("a secure reader password");
    const second = await hashPassword("a secure reader password");
    expect(first).not.toBe(second);
    await expect(verifyPassword("a secure reader password", first)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", first)).resolves.toBe(false);
  });

  it("normalizes emails and creates nonempty temporary passwords", () => {
    expect(normalizeEmail(" Reader@Example.TEST ")).toBe("reader@example.test");
    const temporary = generateTemporaryPassword();
    expect(temporary.length).toBeGreaterThan(12);
    expect(validatePassword(temporary)).toBe(temporary);
  });
});
