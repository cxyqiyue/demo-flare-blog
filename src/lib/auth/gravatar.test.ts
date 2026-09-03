import { describe, expect, it } from "vitest";
import {
  buildGravatarUrl,
  gravatarHash,
  normalizeEmailForAvatar,
} from "@/lib/auth/gravatar";

describe("normalizeEmailForAvatar", () => {
  it("lowercases the email", () => {
    expect(normalizeEmailForAvatar("User@Example.COM")).toBe(
      "user@example.com",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeEmailForAvatar("  user@example.com  ")).toBe(
      "user@example.com",
    );
  });

  it("is invariant for already-normalized input", () => {
    expect(normalizeEmailForAvatar("user@example.com")).toBe(
      "user@example.com",
    );
  });
});

describe("gravatarHash", () => {
  it("matches the well-known MD5 vector for 'hello'", () => {
    expect(gravatarHash("hello")).toBe("5d41402abc4b2a76b9719d911017c592");
  });

  it("is case-insensitive on the email", () => {
    expect(gravatarHash("User@Example.COM")).toBe(
      gravatarHash("user@example.com"),
    );
  });

  it("produces a 32-char lowercase hex", () => {
    const hash = gravatarHash("user@example.com");
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("buildGravatarUrl", () => {
  it("builds the canonical URL matching the email hash", () => {
    const url = buildGravatarUrl("user@example.com");
    expect(url).toBe(
      `https://www.gravatar.com/avatar/${gravatarHash("user@example.com")}`,
    );
  });

  it("appends a size parameter", () => {
    expect(buildGravatarUrl("user@example.com", { size: 256 })).toBe(
      `https://www.gravatar.com/avatar/${gravatarHash(
        "user@example.com",
      )}?s=256`,
    );
  });

  it("appends the default parameter", () => {
    expect(
      buildGravatarUrl("user@example.com", { default: "404" }),
    ).toBe(
      `https://www.gravatar.com/avatar/${gravatarHash(
        "user@example.com",
      )}?d=404`,
    );
  });
});