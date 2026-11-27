import type { AccessGateError } from "../access-gate.types";

type GateErrorPayload = { code?: unknown; retryAfterMs?: unknown };

function asGatePayload(value: unknown): GateErrorPayload {
  return typeof value === "object" && value !== null ? value : {};
}

export function getGateResponseError(payload: unknown): AccessGateError {
  switch (asGatePayload(payload).code) {
    case "WRONG_PASSWORD": return "wrongPassword";
    case "POST_NOT_FOUND": return "postNotFound";
    case "RATE_LIMITED": return "rateLimited";
    default: return "generic";
  }
}

export function getGateRetryDelayMs(
  retryAfter: string | null,
  payload: unknown,
  now = Date.now(),
): number {
  const seconds = retryAfter?.trim() ? Number(retryAfter) : NaN;
  const date = retryAfter ? Date.parse(retryAfter) : NaN;
  const headerDelay = Number.isFinite(seconds)
    ? Math.max(0, seconds * 1000)
    : Number.isFinite(date) ? Math.max(0, date - now) : null;
  const bodyValue = asGatePayload(payload).retryAfterMs;
  const bodyDelay = typeof bodyValue === "number" && Number.isFinite(bodyValue) && bodyValue >= 0 ? bodyValue : null;
  if (headerDelay === null && bodyDelay === null) return 60_000;
  return Math.ceil(Math.max(headerDelay ?? 0, bodyDelay ?? 0));
}
