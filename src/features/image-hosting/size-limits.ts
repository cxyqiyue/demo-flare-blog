import type {
  DiscordChannel,
  HuggingFaceChannel,
  TelegramChannel,
  WebDAVChannel,
} from "@/features/image-hosting/image-hosting.schema";

export const MB = 1024 * 1024;

// ── 渠道默认上传大小上限（MB）；null = 无固定上限 ──────────────
// Telegram Bot API 接受最大 50MB 的上传，但 getFile（生成直链的前提）
// 仅支持 ≤20MB 的文件；CloudFlare-ImgBed 为此按 16MB 分片存储。
// 本项目不做分片，为保证图链始终可用，默认对齐直链上限 20MB，
// 管理员仍可通过渠道配置中的 maxFileSizeMb 覆盖。
export const TELEGRAM_DEFAULT_MAX_MB = 20;
export const DISCORD_DEFAULT_MAX_MB = 10;
export const DISCORD_NITRO_MAX_MB = 25;
export const IMGBB_DEFAULT_MAX_MB = 32;
export const R2_NATIVE_MAX_MB = 100;

export interface ChannelSizeOverride {
  maxFileSizeMb?: number;
}

function mbToBytes(mb: number): number {
  return Math.round(mb * MB);
}

export function resolveTelegramMaxBytes(
  channel?: (TelegramChannel & ChannelSizeOverride) | null,
): number | null {
  if (channel?.maxFileSizeMb && channel.maxFileSizeMb > 0) {
    return mbToBytes(channel.maxFileSizeMb);
  }
  return mbToBytes(TELEGRAM_DEFAULT_MAX_MB);
}

export function resolveDiscordMaxBytes(
  channel?: (DiscordChannel & ChannelSizeOverride) | null,
): number | null {
  if (channel?.maxFileSizeMb && channel.maxFileSizeMb > 0) {
    return mbToBytes(channel.maxFileSizeMb);
  }
  return mbToBytes(channel?.isNitro ? DISCORD_NITRO_MAX_MB : DISCORD_DEFAULT_MAX_MB);
}

export function resolveHuggingFaceMaxBytes(
  channel?: (HuggingFaceChannel & ChannelSizeOverride) | null,
): number | null {
  if (channel?.maxFileSizeMb && channel.maxFileSizeMb > 0) {
    return mbToBytes(channel.maxFileSizeMb);
  }
  return null;
}

export function resolveWebDavMaxBytes(
  channel?: (WebDAVChannel & ChannelSizeOverride) | null,
): number | null {
  if (channel?.maxFileSizeMb && channel.maxFileSizeMb > 0) {
    return mbToBytes(channel.maxFileSizeMb);
  }
  return null;
}

export function resolveS3MaxBytes(
  s3?: { maxFileSizeMb?: number } | null,
): number | null {
  if (s3?.maxFileSizeMb && s3.maxFileSizeMb > 0) {
    return mbToBytes(s3.maxFileSizeMb);
  }
  return null;
}

export function resolveImgbbMaxBytes(): number | null {
  return mbToBytes(IMGBB_DEFAULT_MAX_MB);
}

export function resolveFfskyMaxBytes(): number | null {
  return null;
}

export function resolveR2NativeMaxBytes(): number | null {
  return mbToBytes(R2_NATIVE_MAX_MB);
}

export function formatLimitMb(bytes: number): string {
  const mb = bytes / MB;
  return Number.isInteger(mb) ? String(mb) : mb.toFixed(1);
}
