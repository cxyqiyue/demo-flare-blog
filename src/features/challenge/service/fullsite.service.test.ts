import { describe, expect, it } from "vitest";
import {
  createFullSitePass,
  makeFullSitePassCookie,
  verifyFullSitePass,
} from "./fullsite.service";

function fakeEnv(secret: string): Env {
  return { BETTER_AUTH_SECRET: secret } as unknown as Env;
}

describe("full-site pass cookie", () => {
  it("should create and verify a valid pass", () => {
    const env = fakeEnv("main-secret");
    const value = createFullSitePass(env);
    expect(verifyFullSitePass(env, value)).toBe(true);
  });

  it("should reject a tampered value", () => {
    const env = fakeEnv("main-secret");
    const value = createFullSitePass(env);
    const parts = value.split(".");
    // 篡改 nonce，签名将不匹配
    const tampered = `${parts[0]}.DEADBEEF.${parts[2]}`;
    expect(verifyFullSitePass(env, tampered)).toBe(false);
  });

  it("should reject a value signed with a different secret", () => {
    const env = fakeEnv("main-secret");
    const other = fakeEnv("other-secret");
    const value = createFullSitePass(env);
    expect(verifyFullSitePass(other, value)).toBe(false);
  });

  it("should reject expired value", () => {
    const env = fakeEnv("main-secret");
    // 负 TTL → 立即过期
    const value = createFullSitePass(env, -10);
    expect(verifyFullSitePass(env, value)).toBe(false);
  });

  it("should reject malformed / missing values", () => {
    const env = fakeEnv("main-secret");
    expect(verifyFullSitePass(env, undefined)).toBe(false);
    expect(verifyFullSitePass(env, "garbage")).toBe(false);
    expect(verifyFullSitePass(env, "abc.def")).toBe(false);
    expect(verifyFullSitePass(env, "123.nonce.sha-very-long-signature")).toBe(
      false,
    );
  });

  it("makeFullSitePassCookie should include cookie attributes", () => {
    const env = fakeEnv("main-secret");
    const cookie = makeFullSitePassCookie(env);
    expect(cookie).toContain("fullsite_pass=");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=");
  });
});
