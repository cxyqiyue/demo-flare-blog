import {
  ALTCHA_CHALLENGE_TTL_SECONDS,
  hmacSha256Hex,
  randomHex,
} from "@/features/challenge/pow/altcha";

/**
 * 全站人机验证「一次性会话通行证」：
 * 用户在前台挑战页通过验证后，服务端签发一个无状态、HMAC 签名的 session cookie，
 * 后续前台页面请求凭该 cookie 直接放行，避免每次访问都重复挑战（也节省 Workers 配额）。
 *
 * 无状态设计：cookie 内容为 `expiryEpoch.nonce.hmac`，
 * 校验时不查询 KV，仅重算 HMAC 并检查有效期，零额外配额开销。
 */

export const FULLSITE_PASS_COOKIE = "fullsite_pass";

/** 通行证有效期：24 小时，期内返回访客无需重新挑战。 */
export const FULLSITE_PASS_TTL_SECONDS = 60 * 60 * 24;

const FULLSITE_SECRET_PREFIX = "fullsite-pass-v1:";
/** 用于 ALTCHA 挑战在通过后能重放、以及 DB 权限等。预留常量。 */
const FULLSITE_CHALLENGE_TTL_SECONDS = ALTCHA_CHALLENGE_TTL_SECONDS;

export function getFullSiteSecret(env: Env): string {
  return `${FULLSITE_SECRET_PREFIX}${env.BETTER_AUTH_SECRET}`;
}

/**
 * 签发通行证 cookie 值。
 * @param ttlSeconds 有效期（秒），默认 24h。
 */
export function createFullSitePass(
  env: Env,
  ttlSeconds: number = FULLSITE_PASS_TTL_SECONDS,
): string {
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const nonce = randomHex(16);
  return `${expiry}.${nonce}.${hmacSha256Hex(getFullSiteSecret(env), `${expiry}:${nonce}`)}`;
}

/**
 * 校验通行证 cookie 值。
 * 篡改、过期、格式非法均返回 false。
 */
export function verifyFullSitePass(env: Env, value: string | undefined): boolean {
  if (!value) return false;
  const [expiryStr, nonce, hmac] = value.split(".");
  if (!expiryStr || !nonce || !hmac) return false;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry)) return false;

  const expected = hmacSha256Hex(
    getFullSiteSecret(env),
    `${expiryStr}:${nonce}`,
  );
  if (expected !== hmac) return false;

  return expiry > Math.floor(Date.now() / 1000);
}

/** 构造 Set-Cookie 头（不暴露内部实现细节）。 */
export function makeFullSitePassCookie(env: Env): string {
  const value = createFullSitePass(env);
  return `${FULLSITE_PASS_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${FULLSITE_PASS_TTL_SECONDS}`;
}

export {
  FULLSITE_CHALLENGE_TTL_SECONDS,
};
