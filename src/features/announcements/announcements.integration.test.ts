import {
  createAdminTestContext,
  createMockExecutionCtx,
  seedUser,
} from "tests/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import * as EmailData from "@/features/email/data/email.data";
import * as AnnouncementRepo from "./data/announcements.data";
import * as AnnouncementService from "./announcements.service";

async function seedRecipient(
  db: ReturnType<typeof createAdminTestContext>["db"],
  id: string,
  email: string,
  banned = false,
) {
  await seedUser(db, {
    id,
    name: `User ${id}`,
    email,
    emailVerified: true,
    image: null,
    role: null,
    banned,
    banReason: null,
    banExpires: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("AnnouncementService", () => {
  let adminContext: ReturnType<typeof createAdminTestContext>;

  beforeEach(async () => {
    adminContext = createAdminTestContext({
      executionCtx: createMockExecutionCtx(),
    });
    await seedUser(adminContext.db, adminContext.session.user);
  });

  async function createDraft(title = "公告") {
    return AnnouncementService.createAnnouncement(adminContext, {
      title,
      subject: "主题邮件",
      bodyHtml: "<p>正文内容</p>",
    });
  }

  describe("CRUD", () => {
    it("creates a draft announcement", async () => {
      const result = await createDraft("系统维护公告");
      expect(result.data?.status).toBe("draft");
      expect(result.data?.title).toBe("系统维护公告");
    });

    it("updates a draft announcement", async () => {
      const created = await createDraft();
      const updated = await AnnouncementService.updateAnnouncement(adminContext, {
        id: created.data!.id,
        title: "新标题",
      });
      expect(updated.data?.title).toBe("新标题");
      expect(updated.data?.subject).toBe("主题邮件");
    });

    it("blocks updating an already-sent announcement", async () => {
      await seedRecipient(adminContext.db, "u-a", "a@example.com", false);
      const created = await createDraft();
      await AnnouncementService.sendAnnouncement(adminContext, { id: created.data!.id });
      const updated = await AnnouncementService.updateAnnouncement(adminContext, {
        id: created.data!.id,
        title: "尝试修改",
      });
      expect(updated.error?.reason).toBe("ANNOUNCEMENT_ALREADY_SENT");
    });

    it("deletes an announcement", async () => {
      const created = await createDraft();
      const result = await AnnouncementService.deleteAnnouncement(adminContext, {
        id: created.data!.id,
      });
      expect(result.data?.success).toBe(true);
      const detail = await AnnouncementService.getAnnouncementDetail(adminContext, {
        id: created.data!.id,
      });
      expect(detail).toBeNull();
    });

    it("returns NOT_FOUND for missing announcement", async () => {
      const result = await AnnouncementService.deleteAnnouncement(adminContext, {
        id: 999999,
      });
      expect(result.error?.reason).toBe("ANNOUNCEMENT_NOT_FOUND");
    });
  });

  describe("Send (broadcast)", () => {
    it("broadcasts to all non-banned users and records deliveries", async () => {
      await seedRecipient(adminContext.db, "u-a", "a@example.com", false);
      await seedRecipient(adminContext.db, "u-b", "b@example.com", false);
      await seedRecipient(adminContext.db, "u-c", "c@example.com", true);

      const created = await createDraft();
      const result = await AnnouncementService.sendAnnouncement(adminContext, {
        id: created.data!.id,
      });

      // admin (seeded in beforeEach) + u-a + u-b; u-c 被封禁故排除
      expect(result.data?.recipients).toBe(3);
      expect(result.data?.sentCount).toBe(3);

      const detail = await AnnouncementService.getAnnouncementDetail(adminContext, {
        id: created.data!.id,
      });
      expect(detail?.status).toBe("sent");
      expect(detail?.deliveryStats.total).toBe(3);
      expect(detail?.deliveryStats.sent).toBe(3);
    });

    it("skips users who unsubscribed from announcements", async () => {
      await seedRecipient(adminContext.db, "u-a", "a@example.com", false);
      await seedRecipient(adminContext.db, "u-b", "b@example.com", false);
      await EmailData.unsubscribe(adminContext.db, "u-b", "announcement");

      const created = await createDraft();
      const result = await AnnouncementService.sendAnnouncement(adminContext, {
        id: created.data!.id,
      });

      // admin + u-a；u-b 已退订故排除
      expect(result.data?.recipients).toBe(2);
      const deliveries = await AnnouncementRepo.findAnnouncementDeliveries(
        adminContext.db,
        created.data!.id,
      );
      const ids = deliveries.map((d) => d.userId).sort();
      expect(ids).toEqual(["admin-user-id", "u-a"].sort());
    });

    it("blocks sending an already-sent announcement", async () => {
      await seedRecipient(adminContext.db, "u-a", "a@example.com", false);
      const created = await createDraft();
      await AnnouncementService.sendAnnouncement(adminContext, { id: created.data!.id });
      const second = await AnnouncementService.sendAnnouncement(adminContext, {
        id: created.data!.id,
      });
      expect(second.error?.reason).toBe("ANNOUNCEMENT_ALREADY_SENT");
    });
  });

  describe("Resend", () => {
    it("resends only non-sent deliveries", async () => {
      await seedRecipient(adminContext.db, "u-a", "a@example.com", false);
      const created = await createDraft();
      await AnnouncementService.sendAnnouncement(adminContext, { id: created.data!.id });

      const deliveries = await AnnouncementRepo.findAnnouncementDeliveries(
        adminContext.db,
        created.data!.id,
      );
      await AnnouncementRepo.updateAnnouncementDeliveryStatus(adminContext.db, deliveries[0].id, {
        status: "failed",
        error: "模拟失败",
      });

      const result = await AnnouncementService.resendAnnouncement(adminContext, {
        id: created.data!.id,
      });
      expect(result.data?.resent).toBe(1);

      const after = await AnnouncementRepo.findAnnouncementDeliveries(
        adminContext.db,
        created.data!.id,
      );
      expect(after[0].status).toBe("sent");
    });

    it("rejects resend for a draft", async () => {
      const created = await createDraft();
      const result = await AnnouncementService.resendAnnouncement(adminContext, {
        id: created.data!.id,
      });
      expect(result.error?.reason).toBe("ANNOUNCEMENT_NOT_YET_SENT");
    });
  });

  describe("Recipient listing", () => {
    it("excludes banned and unsubscribed users", async () => {
      await seedRecipient(adminContext.db, "u-a", "a@example.com", false);
      await seedRecipient(adminContext.db, "u-b", "b@example.com", true);
      await EmailData.unsubscribe(adminContext.db, "u-a", "announcement");

      const recipients = await AnnouncementRepo.listAnnouncementRecipients(adminContext.db);
      // admin（beforeEach 种子，未封禁未退订）保留；u-a 退订、u-b 封禁被排除
      expect(recipients).toEqual([
        { userId: "admin-user-id", email: "admin@example.com" },
      ]);
    });
  });

  describe("Deliveries view", () => {
    it("returns delivery rows with email and stats", async () => {
      await seedRecipient(adminContext.db, "u-a", "a@example.com", false);
      const created = await createDraft();
      await AnnouncementService.sendAnnouncement(adminContext, { id: created.data!.id });

      const view = await AnnouncementService.listAnnouncementDeliveries(adminContext, {
        announcementId: created.data!.id,
      });
      // admin + u-a 共计 2 条
      expect(view.items).toHaveLength(2);
      expect(view.deliveryStats.total).toBe(2);
      expect(view.deliveryStats.sent).toBe(2);
    });
  });
});