import {
  createUnlockToken,
  isUnlockTokenValid,
  UNLOCK_TOKEN_TTL_SECONDS,
} from "@/features/posts/utils/post-secret";
import { isSuperAdmin } from "@/lib/auth/access";
import type { PostVisibility } from "@/lib/db/schema";

export const UNLOCK_COOKIE_NAME = "blog_post_unlock";
export const UNLOCK_COOKIE_MAX_AGE_SECONDS = UNLOCK_TOKEN_TTL_SECONDS;
const MAX_UNLOCK_TOKENS = 32;

export interface ViewerAccess {
  userId: string | null;
  isSuperAdmin: boolean;
  unlockTokens: string[];
}

export const UNAUTHENTICATED_VIEWER: ViewerAccess = {
  userId: null,
  isSuperAdmin: false,
  unlockTokens: [],
};

export function extractUnlockTokens(
  cookieHeader: string | null | undefined,
): string[] {
  const part = cookieHeader
    ?.split(";")
    .find((item) => item.trim().startsWith(`${UNLOCK_COOKIE_NAME}=`));
  return part
    ? part
        .trim()
        .slice(UNLOCK_COOKIE_NAME.length + 1)
        .split("&")
        .filter(Boolean)
        .slice(-MAX_UNLOCK_TOKENS)
    : [];
}

export function createViewerAccess(
  env: Env,
  user: { id: string; email: string; role?: string | null } | null | undefined,
  cookieHeader?: string | null,
): ViewerAccess {
  return {
    userId: user?.id ?? null,
    isSuperAdmin: !!user && isSuperAdmin(user, env),
    unlockTokens: extractUnlockTokens(cookieHeader),
  };
}

export async function hasPostUnlock(
  env: Env,
  postId: number,
  passwordHash: string | null,
  unlockTokens: string[],
): Promise<boolean> {
  if (!passwordHash) return false;
  for (const token of unlockTokens.slice(-MAX_UNLOCK_TOKENS)) {
    if (await isUnlockTokenValid(env, token, postId, passwordHash)) return true;
  }
  return false;
}

/** The same ownership policy applies to Post bodies and every related resource. */
export async function canReadPost(
  env: Env,
  post: {
    id: number;
    authorId: string | null;
    visibility: PostVisibility;
    passwordHash: string | null;
  },
  viewer: ViewerAccess,
): Promise<boolean> {
  if (post.visibility === "public") return true;
  if (
    viewer.isSuperAdmin ||
    (viewer.userId !== null && viewer.userId === post.authorId)
  )
    return true;
  return (
    post.visibility === "password" &&
    (await hasPostUnlock(env, post.id, post.passwordHash, viewer.unlockTokens))
  );
}

/** Preserve other Post grants, bound the cookie size, and discard expired grants. */
export async function createUnlockCookieValue(
  env: Env,
  postId: number,
  passwordHash: string,
  existingTokens: string[] = [],
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const tokens = new Map<string, string>();
  for (const token of existingTokens) {
    const match = /^(\d+)\.(\d+)\.[A-Za-z0-9_-]{43}$/.exec(token);
    if (!match || match[1] === String(postId)) continue;
    const expiresAt = Number(match[2]);
    if (expiresAt <= now || expiresAt > now + UNLOCK_TOKEN_TTL_SECONDS)
      continue;
    tokens.set(match[1], token);
  }
  return [
    ...Array.from(tokens.values()).slice(-(MAX_UNLOCK_TOKENS - 1)),
    await createUnlockToken(env, postId, passwordHash),
  ].join("&");
}

export function buildUnlockCookieHeader(token: string, secure = true): string {
  return `${UNLOCK_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${UNLOCK_COOKIE_MAX_AGE_SECONDS}${secure ? "; Secure" : ""}`;
}
