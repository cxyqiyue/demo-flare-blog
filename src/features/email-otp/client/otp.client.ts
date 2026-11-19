export interface OtpSendInput {
  email: string;
  purpose: "login" | "register";
  password?: string;
  turnstileToken?: string | null;
  altchaSolution?: string | null;
}

export type OtpSendResult =
  | { ok: true }
  | { ok: false; code: string; retryAfterMs?: number };

export async function requestSendOtp(
  input: OtpSendInput,
): Promise<OtpSendResult> {
  try {
    const { turnstileToken, altchaSolution, ...body } = input;
    const res = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(turnstileToken ? { "X-Turnstile-Token": turnstileToken } : {}),
        ...(altchaSolution ? { "X-Altcha-Solution": altchaSolution } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as {
      code?: string;
      retryAfterMs?: number;
    } | null;

    if (res.ok) {
      return { ok: true };
    }
    return {
      ok: false,
      code: typeof data?.code === "string" ? data.code : "UNKNOWN",
      retryAfterMs:
        typeof data?.retryAfterMs === "number" ? data.retryAfterMs : undefined,
    };
  } catch {
    return { ok: false, code: "NETWORK_ERROR" };
  }
}
