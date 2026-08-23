import type { DiscordChannel } from "@/features/image-hosting/image-hosting.schema";
import { err, ok, type Result } from "@/lib/errors";

export interface DiscordUploadResult {
  url: string;
  messageId: string;
  fileName: string;
  mimeType: string;
  sizeInBytes: number;
}

export interface DiscordListedFile {
  /** `${messageId}:${attachmentIndex}` — unique per attachment, deletable */
  key: string;
  messageId: string;
  name: string;
  url: string;
  mimeType: string;
  sizeInBytes: number;
}

export function resolveDiscordApiBase(config: DiscordChannel): string {
  const proxyDomain = config.proxyUrl?.trim();
  return proxyDomain
    ? `https://${proxyDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`
    : "https://discord.com/api/v10";
}

function extractErrorMessage(parsed: unknown, responseText: string): string {
  if (typeof parsed === "object" && parsed !== null) {
    const body = parsed as Record<string, unknown>;
    const error = body.error;
    if (error && typeof error === "object") {
      const errorData = error as Record<string, unknown>;
      const message =
        typeof errorData.message === "string" && errorData.message
          ? errorData.message
          : typeof errorData.code === "string" && errorData.code
            ? errorData.code
            : undefined;
      if (message) return message;
    }
    if (typeof body.message === "string" && body.message) {
      return body.message;
    }
  }
  if (responseText) return responseText.slice(0, 300);
  return "Request failed";
}

async function readBody(
  response: Response,
): Promise<{ parsed: unknown; text: string }> {
  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = null;
    }
  }
  return { parsed, text };
}

/**
 * Upload a file to a Discord channel via the Bot API.
 * The returned messageId is the durable handle for later deletion —
 * attachment URLs rotate (~24h signed URLs), message ids do not.
 */
export async function uploadToDiscordChannel(
  config: DiscordChannel,
  file: File,
): Promise<Result<DiscordUploadResult, { reason: string; message: string }>> {
  const botToken = config.botToken?.trim();
  const channelId = config.channelId?.trim();
  if (!botToken || !channelId) {
    return err({
      reason: "DISCORD_UPLOAD_FAILED",
      message: "Discord bot token and channel ID are required",
    });
  }

  const MAX_SIZE = config.isNitro ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return err({
      reason: "DISCORD_UPLOAD_FAILED",
      message: `File exceeds Discord limit of ${config.isNitro ? "25" : "10"}MB`,
    });
  }

  try {
    const form = new FormData();
    form.append("files[0]", file, file.name || "image.png");

    const response = await fetch(
      `${resolveDiscordApiBase(config)}/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}` },
        body: form,
      },
    );
    const { parsed, text } = await readBody(response);

    if (!response.ok) {
      return err({
        reason: "DISCORD_UPLOAD_FAILED",
        message: extractErrorMessage(parsed, text),
      });
    }

    const msg = parsed as Record<string, unknown> | null;
    const messageId = msg?.id as string | undefined;
    const attachments = msg?.attachments as
      | Array<Record<string, unknown>>
      | undefined;
    if (!messageId || !attachments || attachments.length === 0) {
      return err({
        reason: "DISCORD_UPLOAD_FAILED",
        message: "No attachments returned from Discord",
      });
    }

    return ok({
      url: attachments[0].url as string,
      messageId,
      fileName:
        (attachments[0].filename as string) || file.name || "image.png",
      mimeType:
        (attachments[0].content_type as string) ||
        file.type ||
        "application/octet-stream",
      sizeInBytes:
        typeof attachments[0].size === "number"
          ? attachments[0].size
          : file.size,
    });
  } catch (error) {
    return err({
      reason: "DISCORD_UPLOAD_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface DiscordListPage {
  files: DiscordListedFile[];
  nextBefore: string | null;
}

/**
 * List one page (up to 100 messages) of channel attachments directly from
 * the Discord API. This is the authoritative view of the real channel —
 * messages deleted on Discord disappear here too.
 */
export async function listDiscordAttachments(
  config: DiscordChannel,
  before?: string,
): Promise<Result<DiscordListPage, { reason: string; message: string }>> {
  const botToken = config.botToken?.trim();
  const channelId = config.channelId?.trim();
  if (!botToken || !channelId) {
    return err({
      reason: "DISCORD_LIST_FAILED",
      message: "Discord bot token and channel ID are required",
    });
  }

  try {
    const url = `${resolveDiscordApiBase(config)}/channels/${channelId}/messages?limit=100${before ? `&before=${encodeURIComponent(before)}` : ""}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    const { parsed, text } = await readBody(response);

    if (!response.ok) {
      return err({
        reason: "DISCORD_LIST_FAILED",
        message: extractErrorMessage(parsed, text),
      });
    }

    const messages = Array.isArray(parsed)
      ? (parsed as Array<{
          id: string;
          attachments: Array<{
            id: string;
            filename: string;
            url: string;
            content_type?: string;
            size?: number;
          }>;
        }>)
      : [];

    const files: DiscordListedFile[] = [];
    for (const msg of messages) {
      msg.attachments.forEach((att, index) => {
        files.push({
          key: `${msg.id}:${index}`,
          messageId: msg.id,
          name: att.filename,
          url: att.url,
          mimeType: att.content_type || "application/octet-stream",
          sizeInBytes: att.size ?? 0,
        });
      });
    }

    const hasMore = messages.length === 100;
    return ok({
      files,
      nextBefore: hasMore ? (messages[messages.length - 1]?.id ?? null) : null,
    });
  } catch (error) {
    return err({
      reason: "DISCORD_LIST_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface DiscordAttachment {
  url: string;
  fileName: string;
  mimeType: string;
  sizeInBytes: number;
}

/**
 * 按 messageId 现取指定附件的最新签名直链（附件 URL 约 24h 轮换，
 * 代理回源时必须每次现取现用）。
 */
export async function getDiscordMessageAttachment(
  config: DiscordChannel,
  messageId: string,
  index = 0,
): Promise<
  Result<DiscordAttachment, { reason: string; message: string }>
> {
  const botToken = config.botToken?.trim();
  const channelId = config.channelId?.trim();
  if (!botToken || !channelId) {
    return err({
      reason: "DISCORD_RESOLVE_FAILED",
      message: "Discord bot token and channel ID are required",
    });
  }

  try {
    const response = await fetch(
      `${resolveDiscordApiBase(config)}/channels/${channelId}/messages/${messageId}`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );
    const { parsed, text } = await readBody(response);

    if (!response.ok) {
      return err({
        reason: "DISCORD_RESOLVE_FAILED",
        message: extractErrorMessage(parsed, text),
      });
    }

    const msg = parsed as
      | { attachments?: Array<Record<string, unknown>> }
      | null;
    const attachment = msg?.attachments?.[index];
    const url = typeof attachment?.url === "string" ? attachment.url : null;
    if (!attachment || !url) {
      return err({
        reason: "DISCORD_RESOLVE_FAILED",
        message: "Attachment not found on the message",
      });
    }

    return ok({
      url,
      fileName:
        (attachment.filename as string) || `discord-${messageId}-${index}`,
      mimeType:
        (attachment.content_type as string) || "application/octet-stream",
      sizeInBytes:
        typeof attachment.size === "number" ? attachment.size : 0,
    });
  } catch (error) {
    return err({
      reason: "DISCORD_RESOLVE_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Delete the Discord message that carries an attachment.
 * Accepts either a bare messageId or a `${messageId}:${index}` key.
 * A missing message (404) counts as success.
 */
export async function deleteDiscordMessage(
  config: DiscordChannel,
  keyOrMessageId: string,
): Promise<Result<{ success: boolean }, { reason: string; message: string }>> {
  const botToken = config.botToken?.trim();
  const channelId = config.channelId?.trim();
  if (!botToken || !channelId) {
    return err({
      reason: "DISCORD_DELETE_FAILED",
      message: "Discord bot token and channel ID are required",
    });
  }

  const messageId = keyOrMessageId.split(":")[0];

  try {
    const response = await fetch(
      `${resolveDiscordApiBase(config)}/channels/${channelId}/messages/${messageId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bot ${botToken}` },
      },
    );

    if (response.ok || response.status === 404) {
      return ok({ success: true });
    }

    const { parsed, text } = await readBody(response);
    return err({
      reason: "DISCORD_DELETE_FAILED",
      message: extractErrorMessage(parsed, text),
    });
  } catch (error) {
    return err({
      reason: "DISCORD_DELETE_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
