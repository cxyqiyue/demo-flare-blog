import { hex } from "@better-auth/utils/hex";
import { sha256 } from "@noble/hashes/sha2.js";
import { and, eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import {
  OTP_LENGTH,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from "@/features/email-otp/otp-constants";
import { checkEmailAuthRateLimit } from "@/lib/auth/email-rate-limit";
import * as ConfigService from "@/features/config/service/config.service";
import { AuthEmail } from "@/features/email/templates/AuthEmail";
import { account, user, verification } from "@/lib/db/schema";
import { serverEnv } from "@/lib/env/server.env";
import type { Locale } from "@/lib/i18n";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

const PASSWORD_HASHER_POOL_SIZE = 10;

export type OtpPurpose = "login" | "register";

export interface OtpContext {
  db: DB;
  env: Env;
  executionCtx: ExecutionContext;
}

export function getOtpIdentifier(email: string, purpose: OtpPurpose) {
  return `email-otp:${purpose}:${email.trim().toLowerCase()}`;
}

export function generateOtp(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const value =
    ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return String(value % 10 ** OTP_LENGTH).padStart(OTP_LENGTH, "0");
}

export function hashOtp(code: string): string {
  return hex.encode(sha256(new TextEncoder().encode(code)));
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function getPasswordHasher(env: Env) {
  const index = Math.floor(Math.random() * PASSWORD_HASHER_POOL_SIZE);
  const id = env.PASSWORD_HASHER.idFromName(`hasher-${index}`);
  return env.PASSWORD_HASHER.get(id);
}

async function verifyPassword(
  env: Env,
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    const hasher = getPasswordHasher(env);
    return await hasher.verify({ hash, password: password ?? "" });
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "password verify failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return false;
  }
}

function getEmailLocale(env: Env): Locale {
  try {
    return getLocale();
  } catch {
    return serverEnv(env).LOCALE;
  }
}

async function isEmailConfigured(context: OtpContext): Promise<boolean> {
  const config = await ConfigService.getSystemConfig(context);
  return !!(
    config?.email?.host &&
    config.email.username &&
    config.email.password &&
    config.email.senderAddress
  );
}

/* ========================== 下发 ========================== */

export type SendOtpResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "INVALID_EMAIL_OR_PASSWORD"
        | "USER_ALREADY_EXISTS"
        | "RATE_LIMITED"
        | "EMAIL_DISABLED";
      retryAfterMs?: number;
    };

export async function sendOtp(
  context: OtpContext,
  input: { email: string; purpose: OtpPurpose; password?: string },
): Promise<SendOtpResult> {
  const email = input.email.trim().toLowerCase();
  const { db, env } = context;

  if (!(await isEmailConfigured(context))) {
    return { ok: false, code: "EMAIL_DISABLED" };
  }

  if (input.purpose === "login") {
    // 先核对邮箱+密码，避免给错误凭据/试探性登录发件
    const [foundUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    if (!foundUser) {
      return { ok: false, code: "INVALID_EMAIL_OR_PASSWORD" };
    }
    const [foundAccount] = await db
      .select({ password: account.password })
      .from(account)
      .where(
        and(
          eq(account.userId, foundUser.id),
          eq(account.providerId, "credential"),
        ),
      )
      .limit(1);
    if (!foundAccount?.password) {
      return { ok: false, code: "INVALID_EMAIL_OR_PASSWORD" };
    }
    const passwordOk = await verifyPassword(
      env,
      foundAccount.password,
      input.password ?? "",
    );
    if (!passwordOk) {
      return { ok: false, code: "INVALID_EMAIL_OR_PASSWORD" };
    }
  } else {
    const [existing] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    if (existing) {
      return { ok: false, code: "USER_ALREADY_EXISTS" };
    }
  }

  // 每邮箱认证邮件合并限流：10 封 / 小时（登录/注册验证码 + 重置 + 链接验证共享）
  const mergedLimit = await checkEmailAuthRateLimit(env, email);
  if (!mergedLimit.allowed) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      retryAfterMs: mergedLimit.retryAfterMs,
    };
  }

  // 重发冷却：同一邮箱获得了未过期验证码时，至少间隔 30s
  const identifier = getOtpIdentifier(email, input.purpose);
  const [existingOtp] = await db
    .select({ createdAt: verification.createdAt, expiresAt: verification.expiresAt })
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .limit(1);
  if (existingOtp) {
    const elapsed = Date.now() - new Date(existingOtp.createdAt).getTime();
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        code: "RATE_LIMITED",
        retryAfterMs: OTP_RESEND_COOLDOWN_MS - elapsed,
      };
    }
  }

  const code = generateOtp();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

  // 先删除旧码，保证同一邮箱同一用途仅有一个有效验证码（一次性语义）
  await db.delete(verification).where(eq(verification.identifier, identifier));
  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier,
    value: hashOtp(code),
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  const locale = getEmailLocale(env);
  await env.QUEUE.send({
    type: "EMAIL",
    data: {
      to: email,
      subject: m.email_otp_subject({}, { locale }),
      html: renderToStaticMarkup(
        AuthEmail({ locale, type: "otp", code, purpose: input.purpose }),
      ),
    },
  });

  return { ok: true };
}

/* ========================== 校验并消费（一次性） ========================== */

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; reason: "REQUIRED" | "INVALID" | "EXPIRED" };

export async function verifyAndConsumeOtp(
  db: DB,
  input: { email: string; purpose: OtpPurpose; code: string },
): Promise<VerifyOtpResult> {
  const code = input.code.trim();
  if (!code) {
    return { ok: false, reason: "REQUIRED" };
  }

  const identifier = getOtpIdentifier(input.email, input.purpose);
  const [row] = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .limit(1);

  if (!row) {
    return { ok: false, reason: "INVALID" };
  }

  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    await db.delete(verification).where(eq(verification.id, row.id));
    return { ok: false, reason: "EXPIRED" };
  }

  if (!constantTimeEqualHex(row.value, hashOtp(code))) {
    return { ok: false, reason: "INVALID" };
  }

  // 校验即销毁：验证码只能成功使用一次
  await db.delete(verification).where(eq(verification.id, row.id));
  return { ok: true };
}