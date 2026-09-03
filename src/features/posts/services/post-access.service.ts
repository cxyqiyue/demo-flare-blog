import { isAdmin } from "@/lib/auth/access";
import { createUnlockToken, isUnlockTokenValid } from "@/features/posts/utils/post-secret";

/** 单 cookie 存多个文章的解锁令牌，`&` 分隔 */
export const UNLOCK_COOKIE_NAME = "blog_post_unlock";
export const UNLOCK_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface ViewerAccess {
  isAdmin: boolean;
  unlockTokens: string[];
}

export const UNAUTHENTICATED_VIEWER: ViewerAccess = {
  isAdmin: false,
  unlockTokens: [],
};

export function extractUnlockTokens(
  cookieHeader: string | null | undefined,
): string[] {
  if (!cookieHeader) return [];
  const match = cookieHeader
    .split(";")
    .find((part) => part.trim().startsWith(`${UNLOCK_COOKIE_NAME}=`));
  if (!match) return [];
  const value = match.trim().slice(UNLOCK_COOKIE_NAME.length + 1);
  return value ? value.split("&").filter(Boolean) : [];
}

/** 请求方提供的解锁令牌中是否包含该文章的合法令牌（不区分管理员） */
export async function hasPostUnlock(
  env: Env,
  postId: number,
  passwordHash: string | null,
  unlockTokens: string[],
): Promise<boolean> {
  if (!passwordHash) return false;
  for (const token of unlockTokens) {
    if (await isUnlockTokenValid(env, token, postId, passwordHash)) {
      return true;
    }
  }
  return false;
}

export async function createUnlockCookieValue(
  env: Env,
  postId: number,
  passwordHash: string,
): Promise<string> {
  return await createUnlockToken(env, postId, passwordHash);
}

export function buildUnlockCookieHeader(token: string): string {
  return `${UNLOCK_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${UNLOCK_COOKIE_MAX_AGE_SECONDS.toString()}`;
}

export function isSuperAdminUser(
  user: { email?: string | null; role?: string | null } | null | undefined,
  env: Env,
): boolean {
  if (!user?.email) return false;
  return isAdmin(user as { email: string; role?: string | null }, env);
}