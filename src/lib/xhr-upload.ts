/**
 * XMLHttpRequest upload client: fetch cannot observe upload progress,
 * so we use XHR's upload.onprogress to get real byte-level progress
 * (fraction in [0,1]).
 *
 * Response contract (matches the Hono upload routes):
 * - 2xx: { ok: true, data: ... }
 * - non-2xx / parse failure: { ok: false, message }
 */
export interface XhrUploadOptions {
  url: string;
  formData: FormData;
  /** Progress callback; fraction in [0,1]. Invoked at least once per request. */
  onProgress?: (fraction: number) => void;
  /** Timeout in milliseconds; default 120s */
  timeoutMs?: number;
}

export type XhrUploadResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export function xhrUpload<T = unknown>(
  options: XhrUploadOptions,
): Promise<XhrUploadResult<T>> {
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

    const finish = (result: XhrUploadResult<T>) => {
      onProgress?.(1);
      resolve(result);
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
        finish({ ok: true, data: parsed.data });
        return;
      }

      finish({
        ok: false,
        message:
          (parsed && parsed.message) ||
          `Upload failed (HTTP ${xhr.status})`,
      });
    };

    xhr.onerror = () => finish({ ok: false, message: "Network error" });
    xhr.ontimeout = () => finish({ ok: false, message: "Upload timed out" });
    xhr.onabort = () => finish({ ok: false, message: "Upload aborted" });

    xhr.send(formData);
  });
}
