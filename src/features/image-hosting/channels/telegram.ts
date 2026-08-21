import type { TelegramChannel } from "@/features/image-hosting/image-hosting.schema";
import { err, ok, type Result } from "@/lib/errors";

export interface TelegramUploadResult {
  url: string;
  messageId: string;
  fileName: string;
  mimeType: string;
  sizeInBytes: number;
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
 * Upload a file to a Telegram chat via the Bot API (sendPhoto for images).
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

  try {
    const base = resolveApiBase(config);
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("photo", file);

    const response = await fetch(`${base}/bot${botToken}/sendPhoto`, {
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

    const photo = result?.photo as Array<Record<string, unknown>> | undefined;
    const fileId =
      photo && photo.length > 0
        ? (photo[photo.length - 1].file_id as string)
        : undefined;
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
    if (!filePath) {
      return err({
        reason: "TELEGRAM_UPLOAD_FAILED",
        message: "No file_path returned from Telegram getFile",
      });
    }

    return ok({
      url: `${base}/file/bot${botToken}/${filePath}`,
      messageId: String(messageId),
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
