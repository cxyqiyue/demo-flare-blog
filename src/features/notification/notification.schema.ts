import { z } from "zod";

export const NOTIFICATION_CHANNELS = ["email", "webhook"] as const;
export const notificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);
export const NOTIFICATION_EVENT = {
  COMMENT_ADMIN_ROOT_CREATED: "comment.admin_root_created",
  COMMENT_ADMIN_PENDING_REVIEW: "comment.admin_pending_review",
  COMMENT_ADMIN_BLOCKED: "comment.admin_blocked",
  COMMENT_REPLY_TO_ADMIN_PUBLISHED: "comment.reply_to_admin_published",
  COMMENT_REPLY_TO_USER_PUBLISHED: "comment.reply_to_user_published",
  FRIEND_LINK_SUBMITTED: "friend_link.submitted",
  FRIEND_LINK_APPROVED: "friend_link.approved",
  FRIEND_LINK_REJECTED: "friend_link.rejected",
  CLOUDFLARE_USAGE_ALERT: "cloudflare.usage_alert",
} as const;

export const ADMIN_NOTIFICATION_EVENTS = [
  NOTIFICATION_EVENT.COMMENT_ADMIN_ROOT_CREATED,
  NOTIFICATION_EVENT.COMMENT_ADMIN_PENDING_REVIEW,
  NOTIFICATION_EVENT.COMMENT_ADMIN_BLOCKED,
  NOTIFICATION_EVENT.COMMENT_REPLY_TO_ADMIN_PUBLISHED,
  NOTIFICATION_EVENT.FRIEND_LINK_SUBMITTED,
] as const;

export const USER_NOTIFICATION_EVENTS = [
  NOTIFICATION_EVENT.COMMENT_REPLY_TO_USER_PUBLISHED,
  NOTIFICATION_EVENT.FRIEND_LINK_APPROVED,
  NOTIFICATION_EVENT.FRIEND_LINK_REJECTED,
] as const;
export const notificationEventTypeSchema = z.enum(NOTIFICATION_EVENT);

const commentAdminRootCreatedNotificationSchema = z.object({
  type: z.literal(NOTIFICATION_EVENT.COMMENT_ADMIN_ROOT_CREATED),
  data: z.object({
    to: z.string(),
    postTitle: z.string(),
    commenterName: z.string(),
    commentPreview: z.string(),
    commentUrl: z.string(),
  }),
});

const commentAdminPendingReviewNotificationSchema = z.object({
  type: z.literal(NOTIFICATION_EVENT.COMMENT_ADMIN_PENDING_REVIEW),
  data: z.object({
    to: z.string(),
    postTitle: z.string(),
    commenterName: z.string(),
    commentPreview: z.string(),
    reviewUrl: z.string(),
  }),
});

const commentAdminBlockedNotificationSchema = z.object({
  type: z.literal(NOTIFICATION_EVENT.COMMENT_ADMIN_BLOCKED),
  data: z.object({
    to: z.string(),
    postTitle: z.string(),
    commenterName: z.string(),
    commentPreview: z.string(),
    reason: z.string().optional(),
    reviewUrl: z.string(),
  }),
});

const commentReplyToAdminPublishedNotificationSchema = z.object({
  type: z.literal(NOTIFICATION_EVENT.COMMENT_REPLY_TO_ADMIN_PUBLISHED),
  data: z.object({
    to: z.string(),
    postTitle: z.string(),
    replierName: z.string(),
    replyPreview: z.string(),
    commentUrl: z.string(),
    unsubscribeUrl: z.string(),
  }),
});

const commentReplyToUserPublishedNotificationSchema = z.object({
  type: z.literal(NOTIFICATION_EVENT.COMMENT_REPLY_TO_USER_PUBLISHED),
  data: z.object({
    to: z.string(),
    postTitle: z.string(),
    replierName: z.string(),
    replyPreview: z.string(),
    commentUrl: z.string(),
    unsubscribeUrl: z.string(),
  }),
});

const friendLinkSubmittedNotificationSchema = z.object({
  type: z.literal(NOTIFICATION_EVENT.FRIEND_LINK_SUBMITTED),
  data: z.object({
    to: z.string(),
    siteName: z.string(),
    siteUrl: z.string(),
    description: z.string(),
    submitterName: z.string(),
    reviewUrl: z.string(),
  }),
});

const friendLinkApprovedNotificationSchema = z.object({
  type: z.literal(NOTIFICATION_EVENT.FRIEND_LINK_APPROVED),
  data: z.object({
    to: z.string(),
    siteName: z.string(),
    blogUrl: z.string(),
  }),
});

const friendLinkRejectedNotificationSchema = z.object({
  type: z.literal(NOTIFICATION_EVENT.FRIEND_LINK_REJECTED),
  data: z.object({
    to: z.string(),
    siteName: z.string(),
    rejectionReason: z.string().optional(),
  }),
});

// Cloudflare 用量告警：内容由告警服务按管理员语言预渲染，mapper 直接透传
const cloudflareUsageAlertNotificationSchema = z.object({
  type: z.literal(NOTIFICATION_EVENT.CLOUDFLARE_USAGE_ALERT),
  data: z.object({
    subject: z.string(),
    message: z.string(),
    html: z.string(),
  }),
});

export const notificationEventSchema = z.discriminatedUnion("type", [
  commentAdminRootCreatedNotificationSchema,
  commentAdminPendingReviewNotificationSchema,
  commentAdminBlockedNotificationSchema,
  commentReplyToAdminPublishedNotificationSchema,
  commentReplyToUserPublishedNotificationSchema,
  friendLinkSubmittedNotificationSchema,
  friendLinkApprovedNotificationSchema,
  friendLinkRejectedNotificationSchema,
  cloudflareUsageAlertNotificationSchema,
]);

export type NotificationEvent = z.infer<typeof notificationEventSchema>;
export type NotificationEventType = z.infer<typeof notificationEventTypeSchema>;
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
