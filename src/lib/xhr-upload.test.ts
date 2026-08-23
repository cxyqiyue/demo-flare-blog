import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { xhrUpload } from "./xhr-upload";

interface FakeResponse {
  status?: number;
  body?: string;
  headers?: Record<string, string>;
  kind?: "network" | "timeout";
}

class FakeXMLHttpRequest {
  static queue: FakeResponse[] = [];
  static sent: FakeXMLHttpRequest[] = [];

  status = 0;
  responseText = "";
  timeout = 0;
  responseType = "";
  upload: {
    onprogress: ((event: {
      lengthComputable: boolean;
      loaded: number;
      total: number;
    }) => void) | null;
  } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  private responseHeaders: Record<string, string> = {};

  open() {}
  setRequestHeader() {}

  getResponseHeader(name: string): string | null {
    return this.responseHeaders[name.toLowerCase()] ?? null;
  }

  send(): void {
    FakeXMLHttpRequest.sent.push(this);
    const response = FakeXMLHttpRequest.queue.shift();
    if (!response) throw new Error("FakeXMLHttpRequest: no queued response");
    setTimeout(() => this.deliver(response), 0);
  }

  private deliver(response: FakeResponse): void {
    if (response.kind === "network") {
      this.onerror?.();
      return;
    }
    if (response.kind === "timeout") {
      this.ontimeout?.();
      return;
    }
    this.status = response.status ?? 200;
    this.responseText = response.body ?? "";
    this.responseHeaders = Object.fromEntries(
      Object.entries(response.headers ?? {}).map(([key, value]) => [
        key.toLowerCase(),
        value,
      ]),
    );
    this.onload?.();
  }
}

function makeFormData(): FormData {
  const formData = new FormData();
  formData.append("file", new File(["x"], "a.png", { type: "image/png" }));
  return formData;
}

describe("xhrUpload retry behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.XMLHttpRequest =
      FakeXMLHttpRequest as unknown as typeof XMLHttpRequest;
    FakeXMLHttpRequest.queue = [];
    FakeXMLHttpRequest.sent = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries a bare HTTP 429 honoring Retry-After, then succeeds", async () => {
    FakeXMLHttpRequest.queue.push({
      status: 429,
      body: "<html>rate limited</html>",
      headers: { "Retry-After": "1" },
    });
    FakeXMLHttpRequest.queue.push({
      status: 200,
      body: JSON.stringify({ ok: true, data: { url: "https://x/y.png" } }),
    });

    const progress: number[] = [];
    const promise = xhrUpload<{ url: string }>({
      url: "/api/image-hosting/upload",
      formData: makeFormData(),
      onProgress: (fraction) => progress.push(fraction),
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(FakeXMLHttpRequest.sent).toHaveLength(1);

    // Retry-After: 1 → wait 1s before second attempt
    await vi.advanceTimersByTimeAsync(999);
    expect(FakeXMLHttpRequest.sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(10_000);

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(FakeXMLHttpRequest.sent).toHaveLength(2);
    expect(progress.at(-1)).toBe(1);
  });

  it("exhausts max attempts on persistent 429 and reports the status", async () => {
    for (let i = 0; i < 5; i++) {
      FakeXMLHttpRequest.queue.push({ status: 429 });
    }

    const promise = xhrUpload({
      url: "/api/image-hosting/upload",
      formData: makeFormData(),
    });
    await vi.advanceTimersByTimeAsync(60_000);
    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("Upload failed (HTTP 429)");
    // Default maxAttempts = 3 (first try + 2 retries)
    expect(FakeXMLHttpRequest.sent).toHaveLength(3);
  });

  it("does not retry non-retryable client errors", async () => {
    FakeXMLHttpRequest.queue.push({
      status: 413,
      body: JSON.stringify({ ok: false, message: "File too large" }),
    });
    FakeXMLHttpRequest.queue.push({ status: 200, body: '{"ok":true}' });

    const promise = xhrUpload({
      url: "/api/image-hosting/upload",
      formData: makeFormData(),
    });
    await vi.advanceTimersByTimeAsync(60_000);
    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("File too large");
    expect(FakeXMLHttpRequest.sent).toHaveLength(1);
  });

  it("retries transient network errors and timeouts", async () => {
    FakeXMLHttpRequest.queue.push({ kind: "network" });
    FakeXMLHttpRequest.queue.push({ kind: "timeout" });
    FakeXMLHttpRequest.queue.push({
      status: 200,
      body: JSON.stringify({ ok: true, data: 42 }),
    });

    const promise = xhrUpload<number>({
      url: "/api/image-hosting/upload",
      formData: makeFormData(),
    });
    await vi.advanceTimersByTimeAsync(120_000 * 3 + 30_000);
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(FakeXMLHttpRequest.sent).toHaveLength(3);
  });
});
