import type { Context } from "hono";
import { z } from "zod";
import { sendOtp } from "../../service/otp.service";

const otpSendSchema = z.object({
  email: z.email(),
  purpose: z.enum(["login", "register"]),
  password: z.string().optional(),
});

export async function handleOtpSend(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  const body = await c.req.json().catch(() => null);
  const parsed = otpSendSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: "INVALID_INPUT", message: "Invalid request" },
      400,
    );
  }

  const result = await sendOtp(
    {
      db: c.get("db"),
      env: c.env,
      executionCtx: c.executionCtx,
    },
    parsed.data,
  );

  if (!result.ok) {
    switch (result.code) {
      case "INVALID_EMAIL_OR_PASSWORD":
        return c.json(
          { code: result.code, message: "Invalid email or password" },
          401,
        );
      case "USER_ALREADY_EXISTS":
        return c.json(
          { code: result.code, message: "Email already registered" },
          400,
        );
      case "EMAIL_DISABLED":
        return c.json(
          { code: result.code, message: "Email service is not configured" },
          400,
        );
      case "RATE_LIMITED": {
        if (result.retryAfterMs) {
          c.res.headers.set(
            "Retry-After",
            String(Math.ceil(result.retryAfterMs / 1000)),
          );
        }
        return c.json(
          {
            code: result.code,
            message: "Too many requests",
            retryAfterMs: result.retryAfterMs ?? 0,
          },
          429,
        );
      }
    }
  }

  return c.json({ ok: true });
}