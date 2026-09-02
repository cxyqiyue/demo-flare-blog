import { describe, expect, it } from "vitest";
import { isAdmin, isSuperAdmin } from "@/lib/auth/access";

const env = {
  BETTER_AUTH_SECRET: "test-secret-abcdefghijklmnopqrstuvwxyz",
  BETTER_AUTH_URL: "http://localhost:3000",
  ADMIN_EMAIL: "admin@example.com",
  LOCALE: "zh",
  GITHUB_CLIENT_ID: "test-client-id",
  GITHUB_CLIENT_SECRET: "test-client-secret",
  DOMAIN: "example.com",
  ENVIRONMENT: "test",
} as unknown as Env;

describe("isSuperAdmin", () => {
  it("returns true when email matches ADMIN_EMAIL exactly", () => {
    expect(isSuperAdmin({ email: "admin@example.com" }, env)).toBe(true);
  });

  it("returns true when email matches ADMIN_EMAIL case-insensitively", () => {
    expect(isSuperAdmin({ email: "Admin@Example.com" }, env)).toBe(true);
  });

  it("returns false when email does not match ADMIN_EMAIL", () => {
    expect(isSuperAdmin({ email: "user@example.com" }, env)).toBe(false);
  });
});

describe("isAdmin", () => {
  it("allows a user with role admin", () => {
    expect(isAdmin({ email: "user@example.com", role: "admin" }, env)).toBe(
      true,
    );
  });

  it("allows the ADMIN_EMAIL holder regardless of the stored role (runtime-derived)", () => {
    expect(
      isAdmin({ email: "admin@example.com", role: null }, env),
    ).toBe(true);
  });

  it("denies a regular user", () => {
    expect(isAdmin({ email: "user@example.com", role: null }, env)).toBe(false);
  });
});