/**
 * 认证邮件（登录/注册验证码、重置密码链接、邮箱链接验证）的每邮箱发送限流。
 * OTP 验证码使用独立邮箱桶，限制每小时 10 封；其他认证邮件使用 email-auth 桶。
 */
import type {
  RateLimitOptions,
  SlidingWindowLimitOptions,
} from "@/lib/do/rate-limiter";

export const AUTH_EMAIL_SCOPE = "email-auth";
export const AUTH_EMAIL_LIMIT: RateLimitOptions = {
  capacity: 20,
  interval: "1h",
};

export const AUTH_OTP_SEND_LIMIT: SlidingWindowLimitOptions = {
  capacity: 10,
  interval: "1h",
  cooldownMs: 2 * 60 * 1000,
};

export function getEmailAuthRateLimitBucket(env: Env, email: string) {
  const identifier = `${AUTH_EMAIL_SCOPE}:${email.trim().toLowerCase()}`;
  const id = env.RATE_LIMITER.idFromName(identifier);
  return env.RATE_LIMITER.get(id);
}

function getEmailOtpRateLimitBucket(env: Env, email: string) {
  const identifier = `email-otp:${email.trim().toLowerCase()}`;
  const id = env.RATE_LIMITER.idFromName(identifier);
  return env.RATE_LIMITER.get(id);
}

export async function checkEmailAuthRateLimit(
  env: Env,
  email: string,
): Promise<{
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}> {
  const bucket = getEmailAuthRateLimitBucket(env, email);
  return await bucket.checkLimit(AUTH_EMAIL_LIMIT);
}

export async function checkEmailOtpSendLimit(
  env: Env,
  email: string,
  consume = true,
): Promise<{
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}> {
  const bucket = getEmailOtpRateLimitBucket(env, email);
  return await bucket.checkSlidingWindowLimit({
    ...AUTH_OTP_SEND_LIMIT,
    consume,
  });
}
