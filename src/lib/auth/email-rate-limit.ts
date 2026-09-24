/**
 * 认证邮件（登录/注册验证码、重置密码链接、邮箱链接验证）的每邮箱发送限流。
 * 统一使用同一个 Durable Object 桶「email-auth」，按邮箱合计每小时 ≤ AUTH_EMAIL_LIMIT。
 */
import type { RateLimitOptions } from "@/lib/do/rate-limiter";

export const AUTH_EMAIL_SCOPE = "email-auth";
export const AUTH_EMAIL_LIMIT: RateLimitOptions = {
  capacity: 20,
  interval: "1h",
};

export function getEmailAuthRateLimitBucket(env: Env, email: string) {
  const identifier = `${AUTH_EMAIL_SCOPE}:${email.trim().toLowerCase()}`;
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