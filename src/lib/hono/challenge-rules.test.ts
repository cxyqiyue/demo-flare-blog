import { describe, expect, it } from "vitest";
import {
  applyNoCachePageHeaders,
  isProtectedAuthPath,
} from "./challenge-rules";

describe("applyNoCachePageHeaders", () => {
  it("should disable browser and CDN caching", () => {
    const headers = new Headers({ "Cache-Control": "public, max-age=0" });
    applyNoCachePageHeaders(headers);
    expect(headers.get("Cache-Control")).toContain("no-store");
    expect(headers.get("Cache-Control")).toContain("private");
    expect(headers.get("CDN-Cache-Control")).toContain("no-store");
  });
});

describe("isProtectedAuthPath", () => {
  it("should cover the login (sign-in) endpoint", () => {
    expect(isProtectedAuthPath("/api/auth/sign-in/email")).toBe(true);
  });

  it("should cover the register (sign-up) endpoint", () => {
    expect(isProtectedAuthPath("/api/auth/sign-up/email")).toBe(true);
  });

  it("should not cover other auth endpoints", () => {
    expect(isProtectedAuthPath("/api/auth/sign-in/social")).toBe(false);
    expect(isProtectedAuthPath("/api/auth/forget-password")).toBe(false);
    expect(isProtectedAuthPath("/api/auth/send-verification-email")).toBe(
      false,
    );
    expect(isProtectedAuthPath("/api/auth/get-session")).toBe(false);
  });

  it("should be independent of challenge scope (auth-only or full-site)", () => {
    // 该规则是常量集合：全站通行证 cookie 不参与登录/注册端点的人机验证判定，
    // 因此任何 scope 下登录/注册都必须单独完成一次人机验证。
    expect(isProtectedAuthPath("/api/auth/sign-up/email")).toBe(true);
    expect(isProtectedAuthPath("/api/auth/sign-in/email")).toBe(true);
  });
});
