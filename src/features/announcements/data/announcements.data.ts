import {
  and,
  eq,
  inArray,
  ne,
  notInArray,
  sql,
} from "drizzle-orm";
import type {
  Announcement,
  AnnouncementDelivery,
  AnnouncementDeliveryStatus,
  AnnouncementStatus,
} from "@/lib/db/schema";
import {
  AnnouncementDeliveriesTable,
  AnnouncementsTable,
  EmailUnsubscriptionsTable,
  user,
} from "@/lib/db/schema";

// ==================== Announcements ====================

export async function insertAnnouncement(
  db: DB,
  data: {
    title: string;
    subject: string;
    bodyHtml: string;
  },
): Promise<Announcement> {
  const [row] = await db
    .insert(AnnouncementsTable)
    .values({ ...data })
    .returning();
  return row;
}

export async function updateAnnouncement(
  db: DB,
  id: number,
  data: Partial<{
    title: string;
    subject: string;
    bodyHtml: string;
    status: AnnouncementStatus;
    recipientCount: number;
    sentAt: Date;
  }>,
): Promise<Announcement | undefined> {
  const [row] = await db
    .update(AnnouncementsTable)
    .set(data)
    .where(eq(AnnouncementsTable.id, id))
    .returning();
  return row;
}

export async function deleteAnnouncement(
  db: DB,
  id: number,
): Promise<boolean> {
  const found = await findAnnouncementById(db, id);
  if (!found) return false;
  await db.delete(AnnouncementsTable).where(eq(AnnouncementsTable.id, id));
  return true;
}

export async function findAnnouncementById(
  db: DB,
  id: number,
): Promise<Announcement | undefined> {
  const [row] = await db
    .select()
    .from(AnnouncementsTable)
    .where(eq(AnnouncementsTable.id, id))
    .limit(1);
  return row;
}

export async function listAnnouncements(
  db: DB,
  options: { offset?: number; limit?: number } = {},
): Promise<Announcement[]> {
  const { offset = 0, limit = 20 } = options;
  return await db
    .select()
    .from(AnnouncementsTable)
    .orderBy(sql`${AnnouncementsTable.createdAt} desc, ${AnnouncementsTable.id} desc`)
    .limit(Math.min(limit, 100))
    .offset(offset);
}

// ==================== Delivery ====================

export interface AnnouncementRecipient {
  userId: string;
  email: string;
}

/**
 * 拉取全部未封禁用户（含 email），剔除已对 announcement 退订的用户。
 */
export async function listAnnouncementRecipients(
  db: DB,
): Promise<AnnouncementRecipient[]> {
  const rows = await db
    .select({
      userId: user.id,
      email: user.email,
    })
    .from(user)
    .where(
      and(
        ne(user.banned, true),
        sql`${user.email} != ''`,
        notInArray(
          user.id,
          db
            .select({ userId: EmailUnsubscriptionsTable.userId })
            .from(EmailUnsubscriptionsTable)
            .where(eq(EmailUnsubscriptionsTable.type, "announcement")),
        ),
      ),
    );

  return rows.map((r) => ({ userId: r.userId, email: r.email }));
}

export async function insertAnnouncementDeliveries(
  db: DB,
  announcementId: number,
  recipients: AnnouncementRecipient[],
): Promise<void> {
  if (recipients.length === 0) return;
  await db
    .insert(AnnouncementDeliveriesTable)
    .values(
      recipients.map((r) => ({
        announcementId,
        userId: r.userId,
        email: r.email,
        status: "pending" as const,
        attempts: 0,
      })),
    )
    .onConflictDoNothing();
}

export async function findAnnouncementDeliveries(
  db: DB,
  announcementId: number,
): Promise<AnnouncementDelivery[]> {
  return await db
    .select()
    .from(AnnouncementDeliveriesTable)
    .where(eq(AnnouncementDeliveriesTable.announcementId, announcementId));
}

export async function updateAnnouncementDeliveryStatus(
  db: DB,
  deliveryId: number,
  data: {
    status: AnnouncementDeliveryStatus;
    error?: string | null;
    attempts?: number;
  },
): Promise<void> {
  await db
    .update(AnnouncementDeliveriesTable)
    .set(data)
    .where(eq(AnnouncementDeliveriesTable.id, deliveryId));
}

export async function listAnnouncementDeliveries(
  db: DB,
  announcementId: number,
  options: {
    offset?: number;
    limit?: number;
    status?: AnnouncementDeliveryStatus;
  } = {},
): Promise<
  Array<AnnouncementDelivery & { userName: string | null }>
> {
  const { offset = 0, limit = 20, status } = options;
  const conditions = [
    eq(AnnouncementDeliveriesTable.announcementId, announcementId),
  ];
  if (status) {
    conditions.push(eq(AnnouncementDeliveriesTable.status, status));
  }

  return await db
    .select({
      ...getDeliveryRowColumns(),
      userName: user.name,
    })
    .from(AnnouncementDeliveriesTable)
    .leftJoin(
      user,
      eq(AnnouncementDeliveriesTable.userId, user.id),
    )
    .where(and(...conditions))
    .orderBy(sql`${AnnouncementDeliveriesTable.id} desc`)
    .limit(Math.min(limit, 100))
    .offset(offset);
}

export async function countAnnouncementDeliveries(db: DB, announcementId: number) {
  const rows = await db
    .select({
      status: AnnouncementDeliveriesTable.status,
      value: sql<number>`count(*)`,
    })
    .from(AnnouncementDeliveriesTable)
    .where(eq(AnnouncementDeliveriesTable.announcementId, announcementId))
    .groupBy(AnnouncementDeliveriesTable.status);

  const stats = { total: 0, pending: 0, sent: 0, failed: 0 };
  for (const row of rows) {
    stats.total += row.value;
    if (row.status === "pending") stats.pending += row.value;
    else if (row.status === "sent") stats.sent += row.value;
    else if (row.status === "failed") stats.failed += row.value;
  }
  return stats;
}

export async function resetAnnouncementDeliveriesToPending(
  db: DB,
  announcementId: number,
  userIds?: Array<string>,
): Promise<Array<{ userId: string; email: string }>> {
  const conditions = [
    eq(AnnouncementDeliveriesTable.announcementId, announcementId),
    ne(AnnouncementDeliveriesTable.status, "sent"),
  ];
  if (userIds && userIds.length > 0) {
    conditions.push(inArray(AnnouncementDeliveriesTable.userId, userIds));
  }

  const targets = await db
    .select({
      id: AnnouncementDeliveriesTable.id,
      userId: AnnouncementDeliveriesTable.userId,
      email: AnnouncementDeliveriesTable.email,
    })
    .from(AnnouncementDeliveriesTable)
    .where(and(...conditions));

  if (targets.length > 0) {
    await db
      .update(AnnouncementDeliveriesTable)
      .set({ status: "pending", error: null })
      .where(
        inArray(
          AnnouncementDeliveriesTable.id,
          targets.map((t) => t.id),
        ),
      );
  }

  return targets.map((t) => ({ userId: t.userId, email: t.email }));
}

// 空文件快照返回类型不导出；只作为内部列片段
function getDeliveryRowColumns() {
  return {
    id: AnnouncementDeliveriesTable.id,
    announcementId: AnnouncementDeliveriesTable.announcementId,
    userId: AnnouncementDeliveriesTable.userId,
    email: AnnouncementDeliveriesTable.email,
    status: AnnouncementDeliveriesTable.status,
    error: AnnouncementDeliveriesTable.error,
    attempts: AnnouncementDeliveriesTable.attempts,
    createdAt: AnnouncementDeliveriesTable.createdAt,
    updatedAt: AnnouncementDeliveriesTable.updatedAt,
  };
}