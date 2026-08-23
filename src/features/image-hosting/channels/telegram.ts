import type { TelegramChannel } from "@/features/image-hosting/image-hosting.schema";
import { MB } from "@/features/image-hosting/size-limits";
import { err, ok, type Result } from "@/lib/errors";

export interface TelegramUploadResult {
  url: string;
  /** 消息 ID：用于远程删除 */
  messageId: string;
  /** 文件 ID：持久句柄，代理回源时随时 getFile 换取新的临时直链 */
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeInBytes: number;
}

/** 解析媒体库键 `telegram/{messageId}:{fileId}`（兼容旧版纯 messageId） */
export function parseTelegramKey(key: string): {
  messageId: string;
  fileId: string | null;
} {
  const rest = key.replace(/^telegram\//, "");
  const colonIndex = rest.indexOf(":");
  if (colonIndex === -1) return { messageId: rest, fileId: null };
  return {
    messageId: rest.slice(0, colonIndex),
    fileId: rest.slice(colonIndex + 1) || null,
  };
}

/**
 * Telegram renders photos sent via sendPhoto as compressed media and
 * rejects anything above 10 MB. Larger payloads and non-image files go
 * through sendDocument instead (Bot API accepts up to 50 MB there).
 * Like CloudFlare-ImgBed we keep small images on sendPhoto so they get
 * an inline preview inside the chat.
 */
const TELEGRAM_PHOTO_MAX_BYTES = 10 * MB;

function shouldSendAsPhoto(file: File): boolean {
  return (
    file.type.startsWith("image/") && file.size > 0 && file.size <= TELEGRAM_PHOTO_MAX_BYTES
  );
}

function resolveApiBase(config: TelegramChannel): string {
  const proxyDomain = config.proxyUrl?.trim();
  return proxyDomain
    ? `https://${proxyDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`
    : "https://api.telegram.org";
}

async function parseJsonResponse(
  response: Response,
): Promise<Record<string, unknown> | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function extractApiError(parsed: Record<string, unknown> | null): string {
  const description = parsed?.description;
  if (typeof description === "string" && description) return description;
  return `Telegram request failed`;
}

/**
 * Upload a file to a Telegram chat via the Bot API.
 * Small images use sendPhoto; any other file (or image above 10 MB) is
 * sent as a document so the media library can host arbitrary file types.
 * Returns the direct file URL plus the message id, which is the durable
 * handle used later for remote deletion.
 */
export async function uploadToTelegramChannel(
  config: TelegramChannel,
  file: File,
): Promise<Result<TelegramUploadResult, { reason: string; message: string }>> {
  const botToken = config.botToken?.trim();
  const chatId = config.chatId?.trim();
  if (!botToken || !chatId) {
    return err({
      reason: "TELEGRAM_UPLOAD_FAILED",
      message: "Telegram bot token and chat ID are required",
    });
  }

  const asPhoto = shouldSendAsPhoto(file);

  try {
    const base = resolveApiBase(config);
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append(asPhoto ? "photo" : "document", file);

    const response = await fetch(`${base}/bot${botToken}/${asPhoto ? "sendPhoto" : "sendDocument"}`, {
      method: "POST",
      body: form,
    });
    const parsed = await parseJsonResponse(response);

    if (!parsed?.ok) {
      return err({
        reason: "TELEGRAM_UPLOAD_FAILED",
        message: extractApiError(parsed),
      });
    }

    const result = parsed.result as Record<string, unknown> | undefined;
    const messageId = result?.message_id;
    if (typeof messageId !== "number" && typeof messageId !== "string") {
      return err({
        reason: "TELEGRAM_UPLOAD_FAILED",
        message: "No message_id returned from Telegram",
      });
    }

    let fileId: string | undefined;
    if (asPhoto) {
      const photo = result?.photo as Array<Record<string, unknown>> | undefined;
      fileId =
        photo && photo.length > 0 ? (photo[photo.length - 1].file_id as string) : undefined;
    } else {
      const document = result?.document as Record<string, unknown> | undefined;
      fileId = document?.file_id as string | undefined;
    }
    if (!fileId) {
      return err({
        reason: "TELEGRAM_UPLOAD_FAILED",
        message: "No file_id returned from Telegram",
      });
    }

    const fileResp = await fetch(
      `${base}/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
    );
    const fileParsed = await parseJsonResponse(fileResp);
    const fileInfo = fileParsed?.result as Record<string, unknown> | undefined;
    const filePath = fileInfo?.file_path as string | undefined;
    const fetchedFileId =
      typeof fileInfo?.file_id === "string" ? (fileInfo.file_id as string) : fileId;
    if (!filePath || !fetchedFileId) {
      return err({
        reason: "TELEGRAM_UPLOAD_FAILED",
        message: "No file_path returned from Telegram getFile",
      });
    }

    return ok({
      url: `${base}/file/bot${botToken}/${filePath}`,
      messageId: String(messageId),
      fileId: fetchedFileId,
      fileName: file.name,
      mimeType: file.type,
      sizeInBytes: file.size,
    });
  } catch (error) {
    return err({
      reason: "TELEGRAM_UPLOAD_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 按 file_id 现取临时直链（file_path 约 1 小时过期，代理回源时必须
 * 每次 getFile 换新）。Bot Token 仅存在于 Worker 内部，不出现在响应里。
 */
export async function getTelegramFileUrl(
  config: TelegramChannel,
  fileId: string,
): Promise<Result<{ url: string }, { reason: string; message: string }>> {
  const botToken = config.botToken?.trim();
  if (!botToken) {
    return err({
      reason: "TELEGRAM_RESOLVE_FAILED",
      message: "Telegram bot token is required",
    });
  }

  try {
    const base = resolveApiBase(config);
    const response = await fetch(
      `${base}/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
    );
    const parsed = await parseJsonResponse(response);
    const fileInfo = parsed?.result as Record<string, unknown> | undefined;
    const filePath = fileInfo?.file_path as string | undefined;
    if (!parsed?.ok || !filePath) {
      return err({
        reason: "TELEGRAM_RESOLVE_FAILED",
        message: extractApiError(parsed),
      });
    }
    return ok({ url: `${base}/file/bot${botToken}/${filePath}` });
  } catch (error) {
    return err({
      reason: "TELEGRAM_RESOLVE_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Delete a previously uploaded message from the Telegram chat.
 * A missing message counts as success (already gone).
 */
export async function deleteTelegramMessage(
  config: TelegramChannel,
  messageId: string,
): Promise<Result<{ success: boolean }, { reason: string; message: string }>> {
  const botToken = config.botToken?.trim();
  const chatId = config.chatId?.trim();
  if (!botToken || !chatId) {
    return err({
      reason: "TELEGRAM_DELETE_FAILED",
      message: "Telegram bot token and chat ID are required",
    });
  }

  try {
    const base = resolveApiBase(config);
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("message_id", messageId);

    const response = await fetch(`${base}/bot${botToken}/deleteMessage`, {
      method: "POST",
      body: form,
    });
    const parsed = await parseJsonResponse(response);

    if (parsed?.ok) {
      return ok({ success: true });
    }

    const message = extractApiError(parsed);
    // The message is already gone on the remote side — treat as deleted.
    if (/not found/i.test(message)) {
      return ok({ success: true });
    }
    return err({ reason: "TELEGRAM_DELETE_FAILED", message });
  } catch (error) {
    return err({
      reason: "TELEGRAM_DELETE_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
