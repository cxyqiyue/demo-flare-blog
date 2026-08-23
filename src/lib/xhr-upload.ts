/**
 * XMLHttpRequest upload client: fetch cannot observe upload progress,
 * so we use XHR's upload.onprogress to get real byte-level progress
 * (fraction in [0,1]).
 *
 * Response contract (matches the Hono upload routes):
 * - 2xx: { ok: true, data: ... }
 * - non-2xx / parse failure: { ok: false, message }
 *
 * Transient failures (HTTP 429 / 5xx / network errors / timeouts) are
 * retried automatically with exponential backoff, honoring the
 * Retry-After response header when present. This keeps uploads working
 * when a fronting layer (e.g. Cloudflare rate limiting) throttles
 * bursts of requests.
 *
 * Every attempt also runs inside a global upload slot (see
 * ./upload-scheduler) so pasting/dropping many images paces requests
 * instead of firing them all concurrently.
 */
import { withUploadSlot } from "./upload-scheduler";

export interface XhrUploadOptions {
  url: string;
  formData: FormData;
  /** Progress callback; fraction in [0,1]. Invoked at least once per request. */
  onProgress?: (fraction: number) => void;
  /** Timeout in milliseconds; default 120s (applies per attempt) */
  timeoutMs?: number;
  /** Total attempts including the first one; default 3 */
  maxAttempts?: number;
}

export type XhrUploadResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

const MAX_BACKOFF_MS = 15_000;

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Parse the Retry-After header. Spec value is seconds; be lenient with ms values too. */
function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = Number(headerValue);
  if (!Number.isFinite(seconds)) return null;
  const ms = seconds <= 3600 ? seconds * 1000 : seconds;
  return Math.min(Math.max(ms, 500), MAX_BACKOFF_MS);
}

function backoffDelayMs(attemptIndex: number, retryAfterMs: number | null) {
  if (retryAfterMs !== null) return retryAfterMs;
  const exponential = Math.min(1000 * 2 ** attemptIndex, 8000);
  const jitter = Math.random() * 300;
  return Math.min(exponential + jitter, MAX_BACKOFF_MS);
}

interface AttemptOutcome<T> {
  result: XhrUploadResult<T>;
  retryable: boolean;
  retryAfterMs: number | null;
}

function attemptUpload<T>(
  options: Pick<XhrUploadOptions, "url" | "formData" | "onProgress" | "timeoutMs">,
): Promise<AttemptOutcome<T>> {
  const { url, formData, onProgress, timeoutMs = 120_000 } = options;

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.timeout = timeoutMs;
    xhr.responseType = "text";

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || event.total <= 0) return;
        onProgress(Math.min(1, event.loaded / event.total));
      };
    }

    const finish = (
      result: XhrUploadResult<T>,
      extra: Pick<AttemptOutcome<T>, "retryable" | "retryAfterMs">,
    ) => {
      onProgress?.(1);
      resolve({ result, ...extra });
    };

    xhr.onload = () => {
      let parsed: { ok?: boolean; data?: T; message?: string } | null = null;
      try {
        parsed = JSON.parse(xhr.responseText) as
          | { ok?: boolean; data?: T; message?: string }
          | null;
      } catch {
        parsed = null;
      }

      if (xhr.status >= 200 && xhr.status < 300 && parsed && parsed.ok === true && parsed.data !== undefined) {
        finish({ ok: true, data: parsed.data }, { retryable: false, retryAfterMs: null });
        return;
      }

      const retryable = isRetryableStatus(xhr.status);
      finish(
        {
          ok: false,
          message:
            (parsed && parsed.message) ||
            `Upload failed (HTTP ${xhr.status})`,
        },
        {
          retryable,
          retryAfterMs: parseRetryAfterMs(xhr.getResponseHeader("Retry-After")),
        },
      );
    };

    xhr.onerror = () =>
      finish({ ok: false, message: "Network error" }, { retryable: true, retryAfterMs: null });
    xhr.ontimeout = () =>
      finish({ ok: false, message: "Upload timed out" }, { retryable: true, retryAfterMs: null });
    xhr.onabort = () =>
      finish({ ok: false, message: "Upload aborted" }, { retryable: false, retryAfterMs: null });

    xhr.send(formData);
  });
}

export async function xhrUpload<T = unknown>(
  options: XhrUploadOptions,
): Promise<XhrUploadResult<T>> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);

  for (let attemptIndex = 0; ; attemptIndex++) {
    const outcome = await withUploadSlot(() => attemptUpload<T>(options));

    if (!outcome.retryable || attemptIndex >= maxAttempts - 1) {
      return outcome.result;
    }

    if (attemptIndex === 0) options.onProgress?.(0);
    await new Promise((resolveSleep) =>
      setTimeout(
        resolveSleep,
        backoffDelayMs(attemptIndex, outcome.retryAfterMs),
      ),
    );
  }
}
