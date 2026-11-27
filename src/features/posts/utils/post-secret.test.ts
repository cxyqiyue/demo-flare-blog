import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createUnlockToken,
  decryptPassword,
  encryptPassword,
  generateStrongPassword,
  hashPassword,
  isUnlockTokenValid,
  UNLOCK_TOKEN_TTL_SECONDS,
  verifyPassword,
} from "./post-secret";

const env = {
  BETTER_AUTH_SECRET: "post-secret-unit-secret-at-least-32-characters",
  BETTER_AUTH_URL: "https://example.com",
  ADMIN_EMAIL: "super@example.com",
  GITHUB_CLIENT_ID: "test-id",
  GITHUB_CLIENT_SECRET: "test-secret",
  DOMAIN: "example.com",
  ENVIRONMENT: "test",
} as Env;

afterEach(() => vi.restoreAllMocks());

describe("post password secrets", () => {
  it("hashes with independent salts and verifies exact Unicode plaintext", async () => {
    const password = "访问口令-É🐟 with spaces";
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword(password, second)).toBe(true);
    expect(await verifyPassword(password + "!", first)).toBe(false);
    expect(await verifyPassword(password.toLowerCase(), first)).toBe(false);
  });

  it.each([
    null,
    "",
    "missing-separator",
    ":",
    "salt:invalid-digest",
  ])("rejects absent or malformed stored hashes (%s)", async (storedHash) => {
    expect(await verifyPassword("pass", storedHash)).toBe(false);
  });

  it("encrypts identical plaintext differently and decrypts only with the same environment secret", async () => {
    const plaintext = "private phrase 访问密码 🐟";
    const first = await encryptPassword(plaintext, env);
    const second = await encryptPassword(plaintext, env);
    expect(first).not.toBe(second);
    expect(first).not.toContain(plaintext);
    expect(await decryptPassword(first, env)).toBe(plaintext);
    expect(await decryptPassword(second, env)).toBe(plaintext);
    expect(
      await decryptPassword(first, {
        ...env,
        BETTER_AUTH_SECRET: "different-secret-at-least-32-characters",
      }),
    ).toBeNull();
  });

  it("rejects ciphertext modified after encryption", async () => {
    const cipher = await encryptPassword("secret phrase", env);
    const [iv, ciphertext] = cipher.split(":");
    const tampered =
      iv + ":" + (ciphertext.startsWith("A") ? "B" : "A") + ciphertext.slice(1);
    expect(await decryptPassword(tampered, env)).toBeNull();
  });

  it.each([
    null,
    "",
    "not-a-cipher",
  ])("returns no password for an absent cipher (%s)", async (cipher) => {
    expect(await decryptPassword(cipher, env)).toBeNull();
  });

  it("generates distinct passwords at the default and requested lengths", async () => {
    const first = await generateStrongPassword();
    const second = await generateStrongPassword();
    const custom = await generateStrongPassword(40);
    expect(first).toHaveLength(24);
    expect(second).toHaveLength(24);
    expect(custom).toHaveLength(40);
    expect(first).not.toBe(second);
    expect(first).not.toMatch(/[\s01IOl]/);
  });
});

describe("post unlock grants", () => {
  it("binds a grant to its post, password hash, and signing environment", async () => {
    const hash = await hashPassword("correct-pass");
    const token = await createUnlockToken(env, 17, hash);
    expect(await isUnlockTokenValid(env, token, 17, hash)).toBe(true);
    expect(await isUnlockTokenValid(env, token, 18, hash)).toBe(false);
    expect(
      await isUnlockTokenValid(env, token, 17, await hashPassword("new-pass")),
    ).toBe(false);
    expect(
      await isUnlockTokenValid(
        {
          ...env,
          BETTER_AUTH_SECRET: "different-signing-secret-at-least-32-characters",
        },
        token,
        17,
        hash,
      ),
    ).toBe(false);
    expect(token).not.toContain(hash);
    expect(token).not.toContain("correct-pass");
  });

  it("rejects a changed signature instead of trusting its post id and expiry", async () => {
    const hash = await hashPassword("pass");
    const token = await createUnlockToken(env, 17, hash);
    const signatureStart = token.lastIndexOf(".") + 1;
    const tampered =
      token.slice(0, signatureStart) +
      (token[signatureStart] === "A" ? "B" : "A") +
      token.slice(signatureStart + 1);
    expect(await isUnlockTokenValid(env, tampered, 17, hash)).toBe(false);
  });

  it("remains valid until the signed expiry and rejects it exactly at expiry", async () => {
    const start = Date.UTC(2030, 0, 1);
    const clock = vi.spyOn(Date, "now").mockReturnValue(start);
    const hash = await hashPassword("pass");
    const token = await createUnlockToken(env, 17, hash);
    clock.mockReturnValue(start + (UNLOCK_TOKEN_TTL_SECONDS - 1) * 1000);
    expect(await isUnlockTokenValid(env, token, 17, hash)).toBe(true);
    clock.mockReturnValue(start + UNLOCK_TOKEN_TTL_SECONDS * 1000);
    expect(await isUnlockTokenValid(env, token, 17, hash)).toBe(false);
    clock.mockReturnValue(start + (UNLOCK_TOKEN_TTL_SECONDS + 1) * 1000);
    expect(await isUnlockTokenValid(env, token, 17, hash)).toBe(false);
  });

  it("rejects a grant signed with an expiry beyond the permitted lifetime", async () => {
    const now = Date.UTC(2030, 0, 1);
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 60_000);
    const hash = await hashPassword("pass");
    const token = await createUnlockToken(env, 17, hash);
    clock.mockReturnValue(now);
    expect(await isUnlockTokenValid(env, token, 17, hash)).toBe(false);
  });

  it.each([
    "",
    "garbage",
    "17.signature",
    "17.NaN.signature",
    "17.99999999999999999." + "A".repeat(43),
  ])("rejects malformed grants (%s)", async (token) => {
    expect(await isUnlockTokenValid(env, token, 17, "stored-hash")).toBe(false);
  });
});
