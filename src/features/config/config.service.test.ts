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
