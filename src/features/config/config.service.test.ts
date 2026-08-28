import { describe, expect, it } from "vitest";
import { resolveSystemConfig } from "./service/config.service";

const moderation = {
  channel: "workers-ai" as const,
  moderateContentApiKey: "mc-key",
  nsfwApiUrl: "https://nsfw.example.com/check",
};

const linkAccess = {
  mode: "protected" as const,
  refererAllowlist: ["blog.example.com"],
  allowEmptyReferer: false,
};

const imageProcessing = {
  compressEnabled: true,
  convertToFormat: "webp" as const,
  compressThresholdMb: 2,
  compressTargetMb: 1,
};

describe("resolveSystemConfig imageHosting migration", () => {
  it("preserves moderation/linkAccess/imageProcessing for new-format config", () => {
    const resolved = resolveSystemConfig({
      imageHosting: {
        activeProvider: "r2-native",
        r2Native: { articleEnabled: true, commentEnabled: true },
        moderation,
        linkAccess,
        imageProcessing,
      },
    });

    expect(resolved.imageHosting?.moderation).toEqual(moderation);
    expect(resolved.imageHosting?.linkAccess).toEqual(linkAccess);
    expect(resolved.imageHosting?.imageProcessing).toEqual(imageProcessing);
  });

  it("preserves moderation/linkAccess/imageProcessing for legacy-format config", () => {
    const resolved = resolveSystemConfig({
      imageHosting: {
        activeProvider: "api-key",
        imgbb: { apiKey: "legacy-key", articleEnabled: true },
        moderation,
        linkAccess,
        imageProcessing,
      },
    });

    expect(resolved.imageHosting?.moderation).toEqual(moderation);
    expect(resolved.imageHosting?.linkAccess).toEqual(linkAccess);
    expect(resolved.imageHosting?.imageProcessing).toEqual(imageProcessing);
  });

  it("defaults an unset activeProvider to r2-native (fresh/legacy null)", () => {
    const resolved = resolveSystemConfig({
      imageHosting: { activeProvider: null },
    });

    expect(resolved.imageHosting?.activeProvider).toBe("r2-native");
  });

  it("keeps activeProvider null when legacy external channels are configured", () => {
    const resolved = resolveSystemConfig({
      imageHosting: { activeProvider: null, imgbb: { apiKey: "k" } },
    });

    expect(resolved.imageHosting?.activeProvider).toBeNull();
    expect(
      resolved.imageHosting?.apiProviders?.some(
        (p) => p.id === "migrated-imgbb",
      ),
    ).toBe(true);
  });

  it("keeps activeProvider null when new-format api providers have keys", () => {
    const resolved = resolveSystemConfig({
      imageHosting: {
        activeProvider: null,
        apiProviders: [
          {
            id: "imgbb-1",
            name: "ImgBB",
            type: "imgbb" as const,
            apiKey: "imgbb-key",
            articleEnabled: true,
          },
        ],
      },
    });

    expect(resolved.imageHosting?.activeProvider).toBeNull();
  });

  it("preserves an explicitly selected provider", () => {
    const resolved = resolveSystemConfig({
      imageHosting: { activeProvider: "webdav" },
    });

    expect(resolved.imageHosting?.activeProvider).toBe("webdav");
  });

  it("uses DEFAULT_CONFIG imageHosting (r2-native active) when config is absent", () => {
    const resolved = resolveSystemConfig(null);

    expect(resolved.imageHosting?.activeProvider).toBe("r2-native");
    expect(resolved.imageHosting?.r2Native?.articleEnabled).toBe(true);
    expect(resolved.imageHosting?.r2Native?.commentEnabled).toBe(true);
  });

  it("round-trips a saved section without dropping fields (save → resolve → save)", () => {
    // 模拟 updateSystemConfigSection 的合并方式：
    // 第一次保存后 DB 中已是「已解析」配置，第二次保存以其为 current 再解析
    const savedOnce = resolveSystemConfig({
      imageHosting: {
        activeProvider: "r2-native",
        r2Native: { articleEnabled: true, commentEnabled: true },
        s3: { maxFileSizeMb: 25, pathStyle: true },
        moderation,
        linkAccess,
      },
    });

    const savedTwice = resolveSystemConfig({
      ...savedOnce,
      imageHosting: {
        ...savedOnce.imageHosting,
        moderation: { ...moderation, channel: "nsfwjs" as const },
      },
    });

    expect(savedTwice.imageHosting?.moderation?.channel).toBe("nsfwjs");
    expect(savedTwice.imageHosting?.moderation?.nsfwApiUrl).toBe(
      "https://nsfw.example.com/check",
    );
    expect(savedTwice.imageHosting?.linkAccess?.mode).toBe("protected");
    expect(savedTwice.imageHosting?.linkAccess?.refererAllowlist).toEqual([
      "blog.example.com",
    ]);
    expect(savedTwice.imageHosting?.s3?.maxFileSizeMb).toBe(25);
    expect(savedTwice.imageHosting?.s3?.pathStyle).toBe(true);
  });
});

describe("resolveSystemConfig challenge scope", () => {
  it("defaults scope to auth-only when challenge is absent", () => {
    const resolved = resolveSystemConfig(null);
    expect(resolved.challenge?.scope).toBe("auth-only");
  });

  it("defaults scope to auth-only when provider is set but scope is unset", () => {
    const resolved = resolveSystemConfig({
      challenge: { provider: "altcha", altcha: { enabled: true } },
    });
    expect(resolved.challenge?.provider).toBe("altcha");
    expect(resolved.challenge?.scope).toBe("auth-only");
  });

  it("preserves an explicitly selected full-site scope", () => {
    const resolved = resolveSystemConfig({
      challenge: {
        provider: "turnstile",
        scope: "full-site",
        turnstile: { enabled: true },
      },
    });
    expect(resolved.challenge?.scope).toBe("full-site");
  });

  it("round-trips scope when saving a section twice", () => {
    const savedOnce = resolveSystemConfig({
      challenge: { provider: "altcha", scope: "full-site" },
    });
    const savedTwice = resolveSystemConfig({
      ...savedOnce,
      challenge: { ...savedOnce.challenge, scope: "auth-only" },
    });
    expect(savedTwice.challenge?.scope).toBe("auth-only");
    expect(savedTwice.challenge?.provider).toBe("altcha");
  });
});
