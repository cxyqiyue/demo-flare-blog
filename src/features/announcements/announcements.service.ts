import * as AnnouncementRepo from "@/features/announcements/data/announcements.data";
import type {
  AnnouncementDetail,
  CreateAnnouncementInput,
  ListAnnouncementDeliveriesInput,
  ListAnnouncementsInput,
  ResendAnnouncementInput,
  SendAnnouncementInput,
  UpdateAnnouncementInput,
} from "@/features/announcements/announcements.schema";
import * as EmailService from "@/features/email/service/email.service";
import { err, ok } from "@/lib/errors";

type SendEmailResult = Awaited<ReturnType<typeof EmailService.sendEmail>>;

function emailErrorMessage(result: SendEmailResult): string {
  if (!result.error) return "send failed";
  return "message" in result.error && result.error.message
    ? result.error.message
    : result.error.reason;
}

export async function createAnnouncement(
  context: DbContext,
  data: CreateAnnouncementInput,
) {
  const announcement = await AnnouncementRepo.insertAnnouncement(context.db, {
    title: data.title,
    subject: data.subject,
    bodyHtml: data.bodyHtml,
  });
  return ok(announcement);
}

export async function updateAnnouncement(
  context: DbContext,
  data: UpdateAnnouncementInput,
) {
  const existing = await AnnouncementRepo.findAnnouncementById(
    context.db,
    data.id,
  );
  if (!existing) {
    return err({ reason: "ANNOUNCEMENT_NOT_FOUND" });
  }
  // 已发送的公告不可再改内容
  if (existing.status === "sent") {
    return err({ reason: "ANNOUNCEMENT_ALREADY_SENT" });
  }

  const updated = await AnnouncementRepo.updateAnnouncement(context.db, data.id, {
    title: data.title,
    subject: data.subject,
    bodyHtml: data.bodyHtml,
  });
  if (!updated) {
    return err({ reason: "ANNOUNCEMENT_NOT_FOUND" });
  }
  return ok(updated);
}

export async function deleteAnnouncement(
  context: DbContext,
  data: { id: number },
) {
  const deleted = await AnnouncementRepo.deleteAnnouncement(context.db, data.id);
  if (!deleted) {
    return err({ reason: "ANNOUNCEMENT_NOT_FOUND" });
  }
  return ok({ success: true });
}

export async function listAnnouncements(
  context: DbContext,
  data: ListAnnouncementsInput,
) {
  const items = await AnnouncementRepo.listAnnouncements(context.db, data);
  return { items };
}

export async function getAnnouncementDetail(
  context: DbContext,
  data: { id: number },
): Promise<AnnouncementDetail | null> {
  const announcement = await AnnouncementRepo.findAnnouncementById(
    context.db,
    data.id,
  );
  if (!announcement) return null;
  const deliveryStats = await AnnouncementRepo.countAnnouncementDeliveries(
    context.db,
    data.id,
  );
  return { ...announcement, deliveryStats };
}

export async function listAnnouncementDeliveries(
  context: DbContext,
  data: ListAnnouncementDeliveriesInput,
) {
  const items = await AnnouncementRepo.listAnnouncementDeliveries(
    context.db,
    data.announcementId,
    { offset: data.offset, limit: data.limit, status: data.status },
  );
  const deliveryStats = await AnnouncementRepo.countAnnouncementDeliveries(
    context.db,
    data.announcementId,
  );
  return { items, deliveryStats };
}

export async function sendAnnouncement(
  context: DbContext & { executionCtx: ExecutionContext },
  data: SendAnnouncementInput,
) {
  const announcement = await AnnouncementRepo.findAnnouncementById(
    context.db,
    data.id,
  );
  if (!announcement) {
    return err({ reason: "ANNOUNCEMENT_NOT_FOUND" });
  }
  if (announcement.status === "sent") {
    return err({ reason: "ANNOUNCEMENT_ALREADY_SENT" });
  }

  // 1. 锁定收件人（未封禁 + 未退订公告）
  const recipients = await AnnouncementRepo.listAnnouncementRecipients(
    context.db,
  );

  // 2. 写入投递记录（pending）
  await AnnouncementRepo.insertAnnouncementDeliveries(
    context.db,
    data.id,
    recipients,
  );

  // 3. 逐封发送，更新投递状态
  let sentCount = 0;
  for (const recipient of recipients) {
    const deliveries = await AnnouncementRepo.findAnnouncementDeliveries(
      context.db,
      data.id,
    );
    const delivery = deliveries.find((d) => d.userId === recipient.userId);
    if (!delivery) continue;

    const result = await EmailService.sendEmail(context, {
      to: delivery.email,
      subject: announcement.subject,
      html: announcement.bodyHtml,
      unsubscribe: { userId: delivery.userId, type: "announcement" },
    });

    const increment = {
      attempts: delivery.attempts + 1,
    };
    if (result.error) {
      await AnnouncementRepo.updateAnnouncementDeliveryStatus(
        context.db,
        delivery.id,
        {
          status: "failed",
          error: emailErrorMessage(result),
          attempts: increment.attempts,
        },
      );
    } else {
      await AnnouncementRepo.updateAnnouncementDeliveryStatus(
        context.db,
        delivery.id,
        {
          status: "sent",
          error: null,
          attempts: increment.attempts,
        },
      );
      sentCount++;
    }
  }

  // 4. 标记公告已发送
  await AnnouncementRepo.updateAnnouncement(context.db, data.id, {
    status: "sent",
    recipientCount: recipients.length,
    sentAt: new Date(),
  });

  return ok({ success: true, recipients: recipients.length, sentCount });
}

export async function resendAnnouncement(
  context: DbContext & { executionCtx: ExecutionContext },
  data: ResendAnnouncementInput,
) {
  const announcement = await AnnouncementRepo.findAnnouncementById(
    context.db,
    data.id,
  );
  if (!announcement) {
    return err({ reason: "ANNOUNCEMENT_NOT_FOUND" });
  }
  if (announcement.status !== "sent") {
    return err({ reason: "ANNOUNCEMENT_NOT_YET_SENT" });
  }

  const targets = await AnnouncementRepo.resetAnnouncementDeliveriesToPending(
    context.db,
    data.id,
    data.userIds,
  );

  let sentCount = 0;
  let failedCount = 0;
  for (const target of targets) {
    const deliveries = await AnnouncementRepo.findAnnouncementDeliveries(
      context.db,
      data.id,
    );
    const delivery = deliveries.find((d) => d.userId === target.userId);
    if (!delivery) continue;

    const result = await EmailService.sendEmail(context, {
      to: delivery.email,
      subject: announcement.subject,
      html: announcement.bodyHtml,
      unsubscribe: { userId: delivery.userId, type: "announcement" },
    });

    if (result.error) {
      await AnnouncementRepo.updateAnnouncementDeliveryStatus(
        context.db,
        delivery.id,
        {
          status: "failed",
          error: emailErrorMessage(result),
          attempts: delivery.attempts + 1,
        },
      );
      failedCount++;
    } else {
      await AnnouncementRepo.updateAnnouncementDeliveryStatus(
        context.db,
        delivery.id,
        {
          status: "sent",
          error: null,
          attempts: delivery.attempts + 1,
        },
      );
      sentCount++;
    }
  }

  return ok({ success: true, resent: sentCount, failed: failedCount });
}