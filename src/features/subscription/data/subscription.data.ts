import { and, eq, isNull, lt, or } from "drizzle-orm";
import {
  BlogSubscriptionsTable,
  MomentNotificationsTable,
  PostNotificationsTable,
  user,
} from "@/lib/db/schema";

export interface SubscriptionRecipient {
  id: string;
  email: string;
}

export async function getBlogSubscription(db: DB, userId: string) {
  const [row] = await db
    .select()
    .from(BlogSubscriptionsTable)
    .where(eq(BlogSubscriptionsTable.userId, userId))
    .limit(1);
  return row;
}

export async function setBlogSubscription(
  db: DB,
  userId: string,
  subscribed: boolean,
) {
  if (!subscribed) {
    await db
      .delete(BlogSubscriptionsTable)
      .where(eq(BlogSubscriptionsTable.userId, userId));
    return;
  }
  await db
    .insert(BlogSubscriptionsTable)
    .values({ userId })
    .onConflictDoNothing();
}

export async function isPostNotificationCurrent(
  db: DB,
  postId: number,
  contentHash: string,
) {
  const [row] = await db
    .select({ contentHash: PostNotificationsTable.contentHash })
    .from(PostNotificationsTable)
    .where(eq(PostNotificationsTable.postId, postId))
    .limit(1);
  if (!row) return false;
  if (row.contentHash === "") {
    // Rows written before content hashes existed still represent an email
    // already sent. Backfill the hash once so later edits can be detected.
    await db
      .update(PostNotificationsTable)
      .set({ contentHash })
      .where(eq(PostNotificationsTable.postId, postId));
    return true;
  }
  return row.contentHash === contentHash;
}

export async function markPostNotified(
  db: DB,
  postId: number,
  contentHash: string,
) {
  await db
    .insert(PostNotificationsTable)
    .values({ postId, contentHash })
    .onConflictDoUpdate({
      target: PostNotificationsTable.postId,
      set: { contentHash, sentAt: new Date() },
    });
}

export async function isMomentNotificationCurrent(
  db: DB,
  momentId: number,
  contentHash: string,
) {
  const [row] = await db
    .select({ contentHash: MomentNotificationsTable.contentHash })
    .from(MomentNotificationsTable)
    .where(eq(MomentNotificationsTable.momentId, momentId))
    .limit(1);
  return row?.contentHash === contentHash;
}

export async function markMomentNotified(
  db: DB,
  momentId: number,
  contentHash: string,
) {
  await db
    .insert(MomentNotificationsTable)
    .values({ momentId, contentHash })
    .onConflictDoUpdate({
      target: MomentNotificationsTable.momentId,
      set: { contentHash, sentAt: new Date() },
    });
}

function activeUserCondition() {
  const now = new Date();
  return and(
    or(isNull(user.banned), eq(user.banned, false)),
    or(isNull(user.banExpires), lt(user.banExpires, now)),
  );
}

export async function listNotificationRecipients(
  db: DB,
  options: { allUsers: boolean },
): Promise<SubscriptionRecipient[]> {
  const rows = options.allUsers
    ? await db
        .select({ id: user.id, email: user.email })
        .from(user)
        .where(activeUserCondition())
    : await db
        .select({ id: user.id, email: user.email })
        .from(BlogSubscriptionsTable)
        .innerJoin(user, eq(user.id, BlogSubscriptionsTable.userId))
        .where(activeUserCondition());

  return rows.filter((row) => hasUsableEmail(row.email));
}

const PLACEHOLDER_EMAIL_SUFFIXES = ["@better-auth.local", "@placeholder.local"];

export function hasUsableEmail(email: string | null | undefined): boolean {
  const trimmed = (email ?? "").trim();
  if (!trimmed || /\s/.test(trimmed) || !trimmed.includes("@")) {
    return false;
  }
  const lowered = trimmed.toLowerCase();
  return !PLACEHOLDER_EMAIL_SUFFIXES.some((suffix) => lowered.endsWith(suffix));
}
