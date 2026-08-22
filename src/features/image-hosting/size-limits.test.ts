import { describe, expect, it } from "vitest";
import {
  DISCORD_DEFAULT_MAX_MB,
  DISCORD_NITRO_MAX_MB,
  IMGBB_DEFAULT_MAX_MB,
  MB,
  R2_NATIVE_MAX_MB,
  TELEGRAM_DEFAULT_MAX_MB,
  formatLimitMb,
  resolveDiscordMaxBytes,
  resolveFfskyMaxBytes,
  resolveHuggingFaceMaxBytes,
  resolveImgbbMaxBytes,
  resolveR2NativeMaxBytes,
  resolveS3MaxBytes,
  resolveTelegramMaxBytes,
  resolveWebDavMaxBytes,
} from "./size-limits";

describe("size-limits", () => {
  it("telegram defaults to the Bot API document limit and honors overrides", () => {
    expect(resolveTelegramMaxBytes(null)).toBe(TELEGRAM_DEFAULT_MAX_MB * MB);
    expect(resolveTelegramMaxBytes(undefined)).toBe(TELEGRAM_DEFAULT_MAX_MB * MB);
    expect(
      resolveTelegramMaxBytes({ botToken: "t", chatId: "c", proxyUrl: "" }),
    ).toBe(TELEGRAM_DEFAULT_MAX_MB * MB);
    expect(
      resolveTelegramMaxBytes({
        botToken: "t",
        chatId: "c",
        proxyUrl: "",
        maxFileSizeMb: 20,
      }),
    ).toBe(20 * MB);
  });

  it("discord is nitro-aware and honors overrides", () => {
    expect(resolveDiscordMaxBytes({})).toBe(DISCORD_DEFAULT_MAX_MB * MB);
    expect(resolveDiscordMaxBytes({ isNitro: true })).toBe(
      DISCORD_NITRO_MAX_MB * MB,
    );
    expect(resolveDiscordMaxBytes({ isNitro: true, maxFileSizeMb: 8 })).toBe(
      8 * MB,
    );
  });

  it("huggingface / webdav / s3 are unlimited unless overridden", () => {
    expect(resolveHuggingFaceMaxBytes({ token: "t", repo: "r" })).toBeNull();
    expect(
      resolveHuggingFaceMaxBytes({ token: "t", repo: "r", maxFileSizeMb: 15 }),
    ).toBe(15 * MB);
    expect(resolveWebDavMaxBytes({ baseUrl: "https://x" })).toBeNull();
    expect(
      resolveWebDavMaxBytes({ baseUrl: "https://x", maxFileSizeMb: 40 }),
    ).toBe(40 * MB);
    expect(resolveS3MaxBytes(null)).toBeNull();
    expect(resolveS3MaxBytes({ maxFileSizeMb: 60 })).toBe(60 * MB);
  });

  it("api-key style providers have fixed limits", () => {
    expect(resolveImgbbMaxBytes()).toBe(IMGBB_DEFAULT_MAX_MB * MB);
    expect(resolveFfskyMaxBytes()).toBeNull();
  });

  it("r2 native has a hard cap", () => {
    expect(resolveR2NativeMaxBytes()).toBe(R2_NATIVE_MAX_MB * MB);
  });

  it("formatLimitMb renders integers plainly and decimals with one place", () => {
    expect(formatLimitMb(50 * MB)).toBe("50");
    expect(formatLimitMb(1.5 * MB)).toBe("1.5");
  });
});
