import { and, eq, isNull, lt, or } from "drizzle-orm";
import {
  BlogSubscriptionsTable,
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

export async function isPostNotified(db: DB, postId: number) {
  const [row] = await db
    .select({ postId: PostNotificationsTable.postId })
    .from(PostNotificationsTable)
    .where(eq(PostNotificationsTable.postId, postId))
    .limit(1);
  return !!row;
}

export async function markPostNotified(db: DB, postId: number) {
  await db
    .insert(PostNotificationsTable)
    .values({ postId })
    .onConflictDoNothing();
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

const PLACEHOLDER_EMAIL_SUFFIXES = [
  "@better-auth.local",
  "@placeholder.local",
];

export function hasUsableEmail(email: string | null | undefined): boolean {
  const trimmed = (email ?? "").trim();
  if (!trimmed || /\s/.test(trimmed) || !trimmed.includes("@")) {
    return false;
  }
  const lowered = trimmed.toLowerCase();
  return !PLACEHOLDER_EMAIL_SUFFIXES.some((suffix) =>
    lowered.endsWith(suffix),
  );
}
