import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import * as AboutRepo from "@/features/about/data/about-article.data";
import * as AiService from "@/features/ai/ai.service";
import * as CommentService from "@/features/comments/comments.service";
import * as CommentRepo from "@/features/comments/data/comments.data";
import { sendReplyNotification } from "@/features/comments/workflows/helpers";
import * as MomentRepo from "@/features/moments/data/moments.data";
import { publishNotificationEvent } from "@/features/notification/service/notification.publisher";
import * as PostService from "@/features/posts/services/posts.service";
import {
  buildContentPreview,
  convertToPlainText,
} from "@/features/posts/utils/content";
import { getDb } from "@/lib/db";
import { isNotInProduction, serverEnv } from "@/lib/env/server.env";
import { m } from "@/paraglide/messages";

interface Params {
  commentId: number;
}

export class CommentModerationWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { commentId } = event.payload;
    const locale = serverEnv(this.env).LOCALE;

    // Step 1: Fetch the comment
    const comment = await step.do("fetch comment", async () => {
      const db = getDb(this.env);
      return await CommentService.findCommentById(
        { db, env: this.env },
        commentId,
      );
    });

    if (!comment) {
      console.log(
        JSON.stringify({
          message: "comment not found, skipping moderation",
          commentId,
        }),
      );
      return;
    }

    // Skip if comment is already processed or deleted
    if (comment.status !== "verifying") {
      console.log(
        JSON.stringify({
          message: "comment already processed, skipping moderation",
          commentId,
          status: comment.status,
        }),
      );
      return;
    }

    // Fetch the target (post, moment or about) for context
    const target = await step.do<
      | {
          kind: "post";
          title: string;
          summary: string;
          contentPreview: string;
          notificationTarget: { kind: "post"; slug: string; title: string };
        }
      | {
          kind: "moment";
          title: string;
          summary: string;
          contentPreview: string;
          notificationTarget: { kind: "moment"; title: string };
        }
      | {
          kind: "about";
          title: string;
          summary: string;
          contentPreview: string;
          notificationTarget: { kind: "about"; title: string };
        }
      | null
    >("fetch target context", async () => {
      const db = getDb(this.env);
      if (comment.postId != null) {
        const post = await PostService.findPostById(
          { db, env: this.env },
          { id: comment.postId },
        );
        if (!post) {
          console.log(
            JSON.stringify({
              message: "post not found, skipping moderation",
              postId: comment.postId,
            }),
          );
          return null;
        }
        return {
          kind: "post",
          title: post.title,
          summary: post.summary ?? "",
          contentPreview: buildContentPreview(post.contentJson),
          notificationTarget: {
            kind: "post",
            slug: post.slug,
            title: post.title,
          },
        };
      }
      if (comment.momentId != null) {
        const moment = await MomentRepo.findMomentById(db, comment.momentId);
        if (!moment) {
          console.log(
            JSON.stringify({
              message: "moment not found, skipping moderation",
              momentId: comment.momentId,
            }),
          );
          return null;
        }
        return {
          kind: "moment",
          title: m.comments_moment_notification_title(),
          summary: "",
          contentPreview: "",
          notificationTarget: {
            kind: "moment",
            title: m.comments_moment_notification_title(),
          },
        };
      }
      if (comment.aboutArticleId != null) {
        const about = await AboutRepo.findAboutArticleById(
          db,
          comment.aboutArticleId,
        );
        if (!about) {
          console.log(
            JSON.stringify({
              message: "about article not found, skipping moderation",
              aboutArticleId: comment.aboutArticleId,
            }),
          );
          return null;
        }
        return {
          kind: "about",
          title: about.title,
          summary: "",
          contentPreview: "",
          notificationTarget: { kind: "about", title: about.title },
        };
      }
      return null;
    });

    if (!target) return;

    const threadContext = await step.do("fetch thread context", async () => {
      const db = getDb(this.env);
      const [rootComment, replyToComment] = await Promise.all([
        comment.rootId
          ? CommentService.findCommentById(
              { db, env: this.env },
              comment.rootId,
            )
          : null,
        comment.replyToCommentId
          ? CommentService.findCommentById(
              { db, env: this.env },
              comment.replyToCommentId,
            )
          : null,
      ]);

      return {
        rootCommentText: rootComment
          ? convertToPlainText(rootComment.content).trim()
          : "",
        replyToCommentText: replyToComment
          ? convertToPlainText(replyToComment.content).trim()
          : "",
      };
    });

    // Extract plain text from JSONContent
    const plainText = convertToPlainText(comment.content);
    const targetContentPreview = target.contentPreview;
    if (!plainText || plainText.trim().length === 0) {
      // Empty comment, mark as pending for manual review
      await step.do("mark empty comment as pending", async () => {
        const db = getDb(this.env);
        await CommentService.updateCommentStatus(
          { db, env: this.env },
          commentId,
          "pending",
          m.comments_moderation_reason_empty_pending({}, { locale }),
        );
      });
      return;
    }

    // Step 2: Call AI to moderate the content
    const moderationResult = await step.do(
      `moderate comment ${commentId}`,
      {
        retries: {
          limit: 3,
          delay: "5 seconds",
          backoff: "exponential",
        },
      },
      async () => {
        if (isNotInProduction(this.env)) {
          return {
            verdict: "approve",
            reason: m.comments_moderation_reason_dev_approved({}, { locale }),
          };
        }
        try {
          return await AiService.moderateComment(
            { db: getDb(this.env), env: this.env, executionCtx: this.ctx },
            {
              comment: plainText,
              post: {
                title: target.title,
                summary: target.summary,
                contentPreview: targetContentPreview,
              },
              thread: {
                isReply: Boolean(comment.replyToCommentId),
                rootComment: threadContext.rootCommentText,
                replyToComment: threadContext.replyToCommentText,
              },
            },
          );
        } catch (error) {
          // If AI service is not configured, mark as pending for manual review
          console.error(
            JSON.stringify({
              message: "ai moderation failed",
              commentId,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
          return {
            verdict: "review",
            reason: m.comments_moderation_reason_ai_unavailable({}, { locale }),
          };
        }
      },
    );

    // Step 3: Update comment status based on moderation verdict
    await step.do("update comment status", async () => {
      const db = getDb(this.env);

      switch (moderationResult.verdict) {
        case "approve":
          await CommentService.updateCommentStatus(
            { db, env: this.env },
            commentId,
            "published",
            moderationResult.reason,
          );
          break;
        case "block":
          await CommentService.updateCommentStatus(
            { db, env: this.env },
            commentId,
            "blocked",
            moderationResult.reason,
          );
          break;
        case "review":
        default:
          await CommentService.updateCommentStatus(
            { db, env: this.env },
            commentId,
            "pending",
            moderationResult.reason,
          );
          break;
      }
    });

    // Step 3.5: Notify admin when comment is blocked or flagged for review
    if (moderationResult.verdict !== "approve") {
      await step.do("notify admin flagged comment", async () => {
        const db = getDb(this.env);
        const commenter = await CommentRepo.getCommentAuthorWithEmail(
          db,
          comment.id,
        );
        const { ADMIN_EMAIL, DOMAIN } = serverEnv(this.env);
        const commentPreview = plainText.slice(0, 100);
        const reviewUrl = `https://${DOMAIN}/admin/comments`;

        if (moderationResult.verdict === "block") {
          await publishNotificationEvent(
            { db, env: this.env, executionCtx: this.ctx },
            {
              type: "comment.admin_blocked",
              data: {
                to: ADMIN_EMAIL,
                postTitle: target.title,
                commenterName: commenter?.name ?? "匿名用户",
                commentPreview: `${commentPreview}${commentPreview.length >= 100 ? "..." : ""}`,
                reason: moderationResult.reason,
                reviewUrl,
              },
            },
          );
        } else {
          await publishNotificationEvent(
            { db, env: this.env, executionCtx: this.ctx },
            {
              type: "comment.admin_pending_review",
              data: {
                to: ADMIN_EMAIL,
                postTitle: target.title,
                commenterName: commenter?.name ?? "匿名用户",
                commentPreview: `${commentPreview}${commentPreview.length >= 100 ? "..." : ""}`,
                reviewUrl,
              },
            },
          );
        }
      });
    }

    // Step 4: Send reply notification if comment was approved and is a reply
    if (moderationResult.verdict === "approve" && comment.replyToCommentId) {
      await step.do("send reply notification", async () => {
        const db = getDb(this.env);
        await sendReplyNotification(
          { db, env: this.env, executionCtx: this.ctx },
          {
            comment: {
              id: comment.id,
              rootId: comment.rootId,
              replyToCommentId: comment.replyToCommentId,
              userId: comment.userId,
              content: comment.content,
            },
            target: target.notificationTarget,
          },
        );
      });
    }
  }
}
