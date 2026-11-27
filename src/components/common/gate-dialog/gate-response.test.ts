import { describe, expect, it } from "vitest";
import { getGateResponseError, getGateRetryDelayMs } from "./gate-response";

describe("gate response parsing", () => {
  it("uses the longer server cooldown and supports HTTP-date Retry-After", () => {
    const now = Date.UTC(2026, 0, 1);
    expect(getGateRetryDelayMs("2", { retryAfterMs: 3500 }, now)).toBe(3500);
    expect(getGateRetryDelayMs("Thu, 01 Jan 2026 00:00:05 GMT", {}, now)).toBe(5000);
    expect(getGateRetryDelayMs("0", {}, now)).toBe(0);
    expect(getGateRetryDelayMs("invalid", { retryAfterMs: "bad" }, now)).toBe(60_000);
  });
  it("treats malformed or unknown errors as generic", () => {
    expect(getGateResponseError(null)).toBe("generic");
    expect(getGateResponseError("WRONG_PASSWORD")).toBe("generic");
    expect(getGateResponseError({ code: "UNKNOWN" })).toBe("generic");
  });
});
