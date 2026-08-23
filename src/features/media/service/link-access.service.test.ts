import { describe, expect, it } from "vitest";
import type { SystemConfig } from "@/features/config/config.schema";
import {
  buildMediaAccessUrl,
  getLinkAccessSettings,
  isRefererAllowed,
} from "./link-access.service";

const DIRECT = "https://cdn.example.com/pic.jpg";

function request(url: string, referer?: string): Request {
  const headers = new Headers();
  if (referer !== undefined) headers.set("referer", referer);
  return new Request(url, { headers });
}

describe("getLinkAccessSettings", () => {
  it("falls back to direct mode with sane defaults", () => {
    expect(getLinkAccessSettings(undefined)).toEqual({
      mode: "direct",
      refererAllowlist: [],
      allowEmptyReferer: true,
    });
  });

  it("normalizes the allowlist entries", () => {
    const config = {
      imageHosting: {
        linkAccess: {
          mode: "protected",
          allowEmptyReferer: false,
          refererAllowlist: [" https://Blog.Example.com/ ", "*.foo.com", ""],
        },
      },
    } as unknown as SystemConfig;
    const settings = getLinkAccessSettings(config);
    expect(settings.mode).toBe("protected");
    expect(settings.allowEmptyReferer).toBe(false);
    expect(settings.refererAllowlist).toEqual(["blog.example.com", "*.foo.com"]);
  });
});

describe("isRefererAllowed", () => {
  const base = {
    mode: "protected" as "direct" | "protected",
    refererAllowlist: ["example.com"],
    allowEmptyReferer: true,
  };

  it("allows same-site references unconditionally", () => {
    expect(isRefererAllowed(request("https://self.com/i.jpg", "https://self.com/post"), base)).toBe(true);
    expect(
      isRefererAllowed(
        request("https://self.com/i.jpg", "https://self.com/post"),
        { ...base, refererAllowlist: [] },
      ),
    ).toBe(true);
  });

  it("honors the empty-referer setting", () => {
    expect(isRefererAllowed(request("https://self.com/i.jpg"), base)).toBe(true);
    expect(isRefererAllowed(request("https://self.com/i.jpg"), { ...base, allowEmptyReferer: false })).toBe(false);
  });

  it("matches allowlist entries including subdomains and wildcard entries", () => {
    expect(isRefererAllowed(request("https://self.com/i.jpg", "https://example.com/x"), base)).toBe(true);
    expect(isRefererAllowed(request("https://self.com/i.jpg", "https://blog.example.com/x"), base)).toBe(true);
    expect(
      isRefererAllowed(request("https://self.com/i.jpg", "https://a.foo.com/x"), {
        ...base,
        refererAllowlist: ["*.foo.com"],
      }),
    ).toBe(true);
  });

  it("rejects unknown external referers and malformed values", () => {
    expect(isRefererAllowed(request("https://self.com/i.jpg", "https://evil.com/x"), base)).toBe(false);
    // 前缀伪装不等于子域名匹配
    expect(isRefererAllowed(request("https://self.com/i.jpg", "https://evilexample.com/x"), base)).toBe(false);
    expect(isRefererAllowed(request("https://self.com/i.jpg", "::not a url::"), base)).toBe(false);
  });
});

describe("buildMediaAccessUrl", () => {
  const protectedMode = { mode: "protected" as const, refererAllowlist: [], allowEmptyReferer: true };
  const directMode = { mode: "direct" as const, refererAllowlist: [], allowEmptyReferer: true };

  it("keeps r2 on its native path in every mode", () => {
    expect(buildMediaAccessUrl(protectedMode, "r2", "a/b.jpg", "/images/a/b.jpg")).toBe("/images/a/b.jpg");
    expect(buildMediaAccessUrl(directMode, "r2-native", "a/b.jpg", "/images/a/b.jpg")).toBe("/images/a/b.jpg");
  });

  it("always proxies telegram and discord through the bot handles", () => {
    expect(buildMediaAccessUrl(directMode, "telegram", "telegram/4242:file-1", DIRECT)).toBe(
      "/media/file/telegram/4242%3Afile-1",
    );
    expect(buildMediaAccessUrl(protectedMode, "discord", "999:0", DIRECT)).toBe("/media/file/discord/999%3A0");
  });

  it("proxies source-backed channels only in protected mode", () => {
    expect(buildMediaAccessUrl(protectedMode, "s3", "a/b.jpg", DIRECT)).toBe("/media/file/s3/a/b.jpg");
    expect(buildMediaAccessUrl(protectedMode, "huggingface", "a b/c.jpg", DIRECT)).toBe(
      "/media/file/huggingface/a%20b/c.jpg",
    );
    expect(buildMediaAccessUrl(protectedMode, "webdav", "a.jpg", DIRECT)).toBe("/media/file/webdav/a.jpg");
    expect(buildMediaAccessUrl(directMode, "s3", "a/b.jpg", DIRECT)).toBe(DIRECT);
  });

  it("never proxies api-key beds even in protected mode", () => {
    expect(buildMediaAccessUrl(protectedMode, "imgbb", "x.jpg", DIRECT)).toBe(DIRECT);
    expect(buildMediaAccessUrl(protectedMode, "custom-id", "x.jpg", DIRECT)).toBe(DIRECT);
  });
});
