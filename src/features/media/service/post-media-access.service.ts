import { asc, gt } from "drizzle-orm";
import {
  canReadPost,
  createViewerAccess,
  UNAUTHENTICATED_VIEWER,
  type ViewerAccess,
} from "@/features/posts/services/post-access.service";
import { MediaTable, type Post, PostsTable } from "@/lib/db/schema";
import {
  collectManagedMediaReferences,
  contentReferencesMedia,
  type ManagedMediaReference,
  type MediaIdentity,
  mediaIdentityKey,
  normalizeMediaIdentity,
  rewriteManagedMediaUrls,
} from "../utils/post-media-access";

export { rewriteManagedMediaUrls } from "../utils/post-media-access";

export type MediaAccessPost = Pick<
  Post,
  | "id"
  | "authorId"
  | "visibility"
  | "passwordHash"
  | "status"
  | "publishedAt"
  | "contentJson"
  | "publicContentJson"
>;

export type MediaAccessContext = DbContext & {
  viewer?: ViewerAccess;
  session?: { user: { id: string; email: string; role?: string | null } };
};

export function mediaOwnOrigins(
  env: Env,
  extra: readonly string[] = [],
): string[] {
  const extendedEnv = env as Env & { CDN_DOMAIN?: string };
  return [
    extendedEnv.DOMAIN,
    extendedEnv.CDN_DOMAIN,
    extendedEnv.BETTER_AUTH_URL,
    ...extra,
  ].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

export function mediaViewer(context: MediaAccessContext): ViewerAccess {
  return (
    context.viewer ??
    (context.session
      ? createViewerAccess(context.env, context.session.user)
      : UNAUTHENTICATED_VIEWER)
  );
}

/** No relation-table/cache shortcuts: missing or stale post_media rows cannot grant access. */
export async function getCurrentMediaAccessPosts(
  db: DB,
): Promise<MediaAccessPost[]> {
  const result: MediaAccessPost[] = [];
  let cursor = 0;
  for (;;) {
    const rows = await db
      .select({
        id: PostsTable.id,
        authorId: PostsTable.authorId,
        visibility: PostsTable.visibility,
        passwordHash: PostsTable.passwordHash,
        status: PostsTable.status,
        publishedAt: PostsTable.publishedAt,
        contentJson: PostsTable.contentJson,
        publicContentJson: PostsTable.publicContentJson,
      })
      .from(PostsTable)
      .where(gt(PostsTable.id, cursor))
      .orderBy(asc(PostsTable.id))
      .limit(100);
    result.push(...rows);
    if (rows.length < 100) return result;
    cursor = rows[rows.length - 1].id;
  }
}

export async function getManagedMediaReferences(
  db: DB,
): Promise<ManagedMediaReference[]> {
  const result: ManagedMediaReference[] = [];
  let cursor = 0;
  for (;;) {
    const rows = await db
      .select({
        id: MediaTable.id,
        provider: MediaTable.provider,
        key: MediaTable.key,
        url: MediaTable.url,
      })
      .from(MediaTable)
      .where(gt(MediaTable.id, cursor))
      .orderBy(asc(MediaTable.id))
      .limit(100);
    result.push(...rows);
    if (rows.length < 100) return result;
    cursor = rows[rows.length - 1].id;
  }
}

export async function evaluatePostMediaAccess(
  env: Env,
  posts: readonly MediaAccessPost[],
  references: readonly ManagedMediaReference[],
  target: MediaIdentity,
  viewer: ViewerAccess,
  ownOrigins: readonly string[] = [],
  now = new Date(),
): Promise<{ allowed: boolean; associated: boolean }> {
  const identityKey = mediaIdentityKey(target);
  const aliases = references.filter((media) => {
    const identity = normalizeMediaIdentity(media.provider, media.key);
    return identity && mediaIdentityKey(identity) === identityKey;
  });
  let associated = false;
  for (const post of posts) {
    const editable = contentReferencesMedia(
      post.contentJson,
      target,
      aliases,
      ownOrigins,
    );
    const published = contentReferencesMedia(
      post.publicContentJson ?? post.contentJson,
      target,
      aliases,
      ownOrigins,
    );
    if (!editable && !published) continue;
    associated = true;
    if (
      viewer.isSuperAdmin ||
      (viewer.userId !== null && viewer.userId === post.authorId)
    ) {
      return { allowed: true, associated: true };
    }
    // A published Post's new editable-only image is still draft material.
    if (
      published &&
      post.status === "published" &&
      post.publishedAt !== null &&
      post.publishedAt <= now &&
      (await canReadPost(env, post, viewer))
    ) {
      return { allowed: true, associated: true };
    }
  }
  // Independent site assets and genuinely non-Post media retain their existing purpose.
  return { allowed: !associated, associated };
}

export async function canReadPostMedia(
  context: MediaAccessContext,
  target: MediaIdentity,
  options?: { ownOrigins?: string[] },
): Promise<{ allowed: boolean; associated: boolean }> {
  const [posts, references] = await Promise.all([
    getCurrentMediaAccessPosts(context.db),
    getManagedMediaReferences(context.db),
  ]);
  return evaluatePostMediaAccess(
    context.env,
    posts,
    references,
    target,
    mediaViewer(context),
    mediaOwnOrigins(context.env, options?.ownOrigins),
  );
}

/** Call after Post body authorization. Never persist the response-only rewritten JSON. */
export async function rewritePostMediaUrls<T>(
  context: DbContext,
  content: T,
  options?: { ownOrigins?: string[] },
): Promise<T> {
  if (content === null || content === undefined) return content;
  return rewriteManagedMediaUrls(
    content,
    await getManagedMediaReferences(context.db),
    mediaOwnOrigins(context.env, options?.ownOrigins),
  );
}

/** Prevent another admin from laundering a private media URL through a new public Post. */
export async function assertPostMediaReferencesReadable(
  context: MediaAccessContext,
  oldContent: unknown,
  newContent: unknown,
): Promise<boolean> {
  const viewer = mediaViewer(context);
  if (viewer.isSuperAdmin) return true;
  const references = await getManagedMediaReferences(context.db);
  const origins = mediaOwnOrigins(context.env);
  const oldRefs = collectManagedMediaReferences(
    oldContent,
    references,
    origins,
  );
  const nextRefs = collectManagedMediaReferences(
    newContent,
    references,
    origins,
  );
  const added = [...nextRefs].filter(([key]) => !oldRefs.has(key));
  if (added.length === 0) return true;
  const posts = await getCurrentMediaAccessPosts(context.db);
  for (const [, target] of added) {
    if (
      !(
        await evaluatePostMediaAccess(
          context.env,
          posts,
          references,
          target,
          viewer,
          origins,
        )
      ).allowed
    )
      return false;
  }
  return true;
}

export async function filterReadableMediaItems<
  T extends { key: string; provider?: string },
>(
  context: MediaAccessContext,
  items: readonly T[],
  provider = "r2",
): Promise<T[]> {
  const viewer = mediaViewer(context);
  if (viewer.isSuperAdmin || items.length === 0) return [...items];
  const [posts, references] = await Promise.all([
    getCurrentMediaAccessPosts(context.db),
    getManagedMediaReferences(context.db),
  ]);
  const result: T[] = [];
  const origins = mediaOwnOrigins(context.env);
  for (const item of items) {
    const target = normalizeMediaIdentity(item.provider ?? provider, item.key);
    if (
      target &&
      (
        await evaluatePostMediaAccess(
          context.env,
          posts,
          references,
          target,
          viewer,
          origins,
        )
      ).allowed
    )
      result.push(item);
  }
  return result;
}

export function applyMediaNoStoreHeaders(headers: Headers): void {
  for (const name of [
    "Cache-Control",
    "CDN-Cache-Control",
    "Cloudflare-CDN-Cache-Control",
  ])
    headers.set(name, "private, no-store");
  const vary = new Set(
    (headers.get("Vary") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  vary.add("Cookie");
  vary.add("Accept");
  headers.set("Vary", [...vary].join(", "));
}
