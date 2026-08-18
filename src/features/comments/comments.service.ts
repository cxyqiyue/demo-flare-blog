import { findAboutArticleById } from "@/features/about/data/about-article.data";
import type {
  CreateCommentInput,
  DeleteCommentInput,
  GetAllCommentsInput,
  GetCommentsByTargetInput,
  GetMyCommentsInput,
  ModerateCommentInput,
  StartCommentModerationInput,
} from "@/features/comments/comments.schema";
import type { CommentTarget } from "@/features/comments/data/comments.data";
import * as CommentRepo from "@/features/comments/data/comments.data";
import { sendReplyNotification } from "@/features/comments/workflows/helpers";
import * as MomentRepo from "@/features/moments/data/moments.data";
import { publishNotificationEvent } from "@/features/notification/service/notification.publisher";
import * as PostService from "@/features/posts/services/posts.service";
import { convertToPlainText } from "@/features/posts/utils/content";
import { serverEnv } from "@/lib/env/server.env";
import { err, ok } from "@/lib/errors";
import { m } from "@/paraglide/messages";

function resolveTarget(data: {
  postId?: number;
  momentId?: number;
  aboutArticleId?: number;
}): CommentTarget {
  if (data.aboutArticleId) {
    return { aboutArticleId: data.aboutArticleId };
  }
  if (data.momentId) {
    return { momentId: data.momentId };
  }
  return { postId: data.postId ?? 0 };
}

async function getTargetContext(
  context: DbContext & { executionCtx: ExecutionContext },
  comment: {
    id: number;
    rootId: number | null;
    postId: number | null;
    momentId: number | null;
    aboutArticleId: number | null;
  },
) {
  if (comment.postId != null) {
    const post = await PostService.findPostById(context, {
      id: comment.postId,
    });
    if (post) {
      return {
        kind: "post" as const,
        title: post.title,
        commentUrl: `https://${serverEnv(context.env).DOMAIN}/post/${encodeURIComponent(post.slug)}?highlightCommentId=${comment.id}&rootId=${comment.rootId ?? comment.id}#comment-${comment.id}`,
        post: { slug: post.slug, title: post.title },
      };
    }
  }
  if (comment.momentId != null) {
    const moment = await MomentRepo.findMomentById(
      context.db,
      comment.momentId,
    );
    if (moment) {
      return {
        kind: "moment" as const,
        title: m.comments_moment_notification_title(),
        commentUrl: `https://${serverEnv(context.env).DOMAIN}/moments?highlightCommentId=${comment.id}&rootId=${comment.rootId ?? comment.id}#comment-${comment.id}`,
      };
    }
  }
  if (comment.aboutArticleId != null) {
    const about = await findAboutArticleById(
      context.db,
      comment.aboutArticleId,
    );
    if (about) {
      return {
        kind: "about" as const,
        title: about.title,
        commentUrl: `https://${serverEnv(context.env).DOMAIN}/about?highlightCommentId=${comment.id}&rootId=${comment.rootId ?? comment.id}#comment-${comment.id}`,
      };
    }
  }
  return null;
}

async function sendCommentTargetNotification(
  context: AuthContext & { executionCtx: ExecutionContext },
  comment: {
    id: number;
    rootId: number | null;
    replyToCommentId: number | null;
    userId: string | null;
    content: unknown;
    postId: number | null;
    momentId: number | null;
    aboutArticleId: number | null;
  },
) {
  if (!comment.replyToCommentId) return;
  await sendReplyNotificationForTarget(context, comment);
}

async function sendReplyNotificationForTarget(
  context: DbContext & { executionCtx: ExecutionContext },
  comment: {
    id: number;
    rootId: number | null;
    replyToCommentId: number | null;
    userId: string | null;
    content: unknown;
    postId: number | null;
    momentId: number | null;
    aboutArticleId: number | null;
  },
  moderatorUserId?: string,
) {
  const target = await getTargetContext(context, comment);
  if (!target) return;
  if (target.kind === "post") {
    await sendReplyNotification(context, {
      comment: {
        id: comment.id,
        rootId: comment.rootId,
        replyToCommentId: comment.replyToCommentId,
        userId: comment.userId,
        content: comment.content as Parameters<
          typeof sendReplyNotification
        >[1]["comment"]["content"],
      },
      target: {
        kind: "post",
        slug: target.post.slug,
        title: target.post.title,
      },
      skipNotifyUserId: moderatorUserId,
    });
  } else if (target.kind === "moment") {
    await sendReplyNotification(context, {
      comment: {
        id: comment.id,
        rootId: comment.rootId,
        replyToCommentId: comment.replyToCommentId,
        userId: comment.userId,
        content: comment.content as Parameters<
          typeof sendReplyNotification
        >[1]["comment"]["content"],
      },
      target: { kind: "moment", title: target.title },
      skipNotifyUserId: moderatorUserId,
    });
  } else if (target.kind === "about") {
    await sendReplyNotification(context, {
      comment: {
        id: comment.id,
        rootId: comment.rootId,
        replyToCommentId: comment.replyToCommentId,
        userId: comment.userId,
        content: comment.content as Parameters<
          typeof sendReplyNotification
        >[1]["comment"]["content"],
      },
      target: { kind: "about", title: target.title },
      skipNotifyUserId: moderatorUserId,
    });
  }
}

async function notifyAdminRootComment(
  context: AuthContext & { executionCtx: ExecutionContext },
  comment: {
    id: number;
    rootId: number | null;
    replyToCommentId: number | null;
    userId: string | null;
    content: unknown;
    postId: number | null;
    momentId: number | null;
    aboutArticleId: number | null;
  },
  content: unknown,
) {
  const target = await getTargetContext(context, comment);
  if (!target) return;
  const { ADMIN_EMAIL } = serverEnv(context.env);
  const commentPreview = convertToPlainText(content as never).slice(0, 100);
  const commenterName = context.session.user.name;
  await publishNotificationEvent(context, {
    type: "comment.admin_root_created",
    data: {
      to: ADMIN_EMAIL,
      postTitle: target.title,
      commenterName,
      commentPreview: `${commentPreview}${commentPreview.length >= 100 ? "..." : ""}`,
      commentUrl: target.commentUrl,
    },
  });
}

// ============ Public Service Methods ============

export async function getRootCommentsByTarget(
  context: DbContext,
  data: GetCommentsByTargetInput & { viewerId?: string },
) {
  const target = resolveTarget(data);

  const [items, total] = await Promise.all([
    CommentRepo.getRootCommentsByTarget(context.db, target, {
      offset: data.offset,
      limit: data.limit,
      viewerId: data.viewerId,
      status: data.viewerId ? undefined : ["published", "deleted"],
    }),
    CommentRepo.getRootCommentsByTargetCount(context.db, target, {
      viewerId: data.viewerId,
      status: data.viewerId ? undefined : ["published", "deleted"],
    }),
  ]);

  // Get reply counts for each root comment
  const itemsWithReplyCount = await Promise.all(
    items.map(async (item) => {
      const replyCount = await CommentRepo.getReplyCountByRootId(
        context.db,
        target,
        item.id,
        {
          viewerId: data.viewerId,
          status: data.viewerId ? undefined : ["published", "deleted"],
        },
      );
      return { ...item, replyCount };
    }),
  );

  return { items: itemsWithReplyCount, total };
}

export async function getRepliesByRootId(
  context: DbContext,
  data: GetCommentsByTargetInput & {
    rootId: number;
    viewerId?: string;
  },
) {
  const target = resolveTarget(data);

  const [items, total] = await Promise.all([
    CommentRepo.getRepliesByRootId(context.db, target, data.rootId, {
      offset: data.offset,
      limit: data.limit,
      viewerId: data.viewerId,
      status: data.viewerId ? undefined : ["published", "deleted"],
    }),
    CommentRepo.getRepliesByRootIdCount(context.db, target, data.rootId, {
      viewerId: data.viewerId,
      status: data.viewerId ? undefined : ["published", "deleted"],
    }),
  ]);

  return { items, total };
}

// ============ Authed User Service Methods ============

export async function createComment(
  context: AuthContext & { executionCtx: ExecutionContext },
  data: CreateCommentInput,
) {
  // Validation: ensure exactly one target is provided
  const hasPost = typeof data.postId === "number";
  const hasMoment = typeof data.momentId === "number";
  const hasAbout = typeof data.aboutArticleId === "number";
  if ([hasPost, hasMoment, hasAbout].filter(Boolean).length !== 1) {
    return err({ reason: "INVALID_TARGET" });
  }
  const target: CommentTarget = hasAbout
    ? { aboutArticleId: data.aboutArticleId! }
    : hasMoment
      ? { momentId: data.momentId! }
      : { postId: data.postId! };
  const targetPostId = hasPost ? data.postId! : null;
  const targetMomentId = hasMoment ? data.momentId! : null;
  const targetAboutArticleId = hasAbout ? data.aboutArticleId! : null;

  // Validation: ensure 2-level structure
  let rootId: number | null = null;
  let replyToCommentId: number | null = null;

  if (data.rootId) {
    // Creating a reply - validate rootId exists and is a root comment
    const rootComment = await CommentRepo.findCommentById(
      context.db,
      data.rootId,
    );
    if (!rootComment) {
      return err({ reason: "ROOT_COMMENT_NOT_FOUND" });
    }
    if (rootComment.rootId !== null) {
      return err({ reason: "INVALID_ROOT_ID" });
    }
    if (
      rootComment.postId !== targetPostId ||
      rootComment.momentId !== targetMomentId ||
      rootComment.aboutArticleId !== targetAboutArticleId
    ) {
      return err({ reason: "ROOT_COMMENT_POST_MISMATCH" });
    }
    rootId = data.rootId;

    // If replyToCommentId is provided, validate it belongs to the same root
    if (data.replyToCommentId) {
      const replyToComment = await CommentRepo.findCommentById(
        context.db,
        data.replyToCommentId,
      );
      if (!replyToComment) {
        return err({ reason: "REPLY_TO_COMMENT_NOT_FOUND" });
      }
      // replyToComment must be either the root or a reply under the same root
      const actualRootId = replyToComment.rootId ?? replyToComment.id;
      if (actualRootId !== rootId) {
        return err({ reason: "REPLY_TO_COMMENT_ROOT_MISMATCH" });
      }
      replyToCommentId = data.replyToCommentId;
    } else {
      // If no replyToCommentId, default to replying to the root
      replyToCommentId = rootId;
    }
  } else {
    // Creating a root comment - ensure no replyToCommentId
    if (data.replyToCommentId) {
      return err({ reason: "ROOT_COMMENT_CANNOT_HAVE_REPLY_TO" });
    }
  }

  const isAdmin = context.session.user.role === "admin";

  const comment = await CommentRepo.insertComment(context.db, {
    ...target,
    content: data.content,
    rootId,
    replyToCommentId,
    userId: context.session.user.id,
    // Admin comments are published immediately, others go through moderation
    status: isAdmin ? "published" : "verifying",
  });

  // Trigger AI moderation workflow only for non-admin users
  if (!isAdmin) {
    await startCommentModerationWorkflow(context, { commentId: comment.id });
  }

  // Send reply notification for admin replies (non-admin replies get notified via moderation workflow)
  if (isAdmin && replyToCommentId) {
    await sendCommentTargetNotification(context, comment);
  }

  // Notify admin about new root comments from non-admin users only
  // - Skip if admin is commenting (no need to notify yourself)
  // - Skip if it's a reply (only root comments trigger admin notification)
  const isRootComment = rootId === null;
  if (!isAdmin && isRootComment) {
    await notifyAdminRootComment(context, comment, data.content);
  }

  return ok(comment);
}

export async function deleteComment(
  context: AuthContext,
  data: DeleteCommentInput,
) {
  const comment = await CommentRepo.findCommentById(context.db, data.id);

  if (!comment) {
    return err({ reason: "COMMENT_NOT_FOUND" });
  }

  // Only allow deleting own comments (unless admin)
  const userRole = context.session.user.role;
  if (comment.userId !== context.session.user.id && userRole !== "admin") {
    return err({ reason: "PERMISSION_DENIED" });
  }

  // Soft delete by setting status to deleted
  await CommentRepo.updateComment(context.db, data.id, {
    status: "deleted",
  });

  return ok({ success: true });
}

export async function getMyComments(
  context: AuthContext,
  data: GetMyCommentsInput,
) {
  return await CommentRepo.getCommentsByUserId(
    context.db,
    context.session.user.id,
    {
      offset: data.offset,
      limit: data.limit,
      status: data.status,
    },
  );
}

// ============ Admin Service Methods ============

export async function getAllComments(
  context: DbContext,
  data: GetAllCommentsInput,
) {
  const [items, total] = await Promise.all([
    CommentRepo.getAllComments(context.db, {
      offset: data.offset,
      limit: data.limit,
      status: data.status,
      postId: data.postId,
      momentId: data.momentId,
      aboutArticleId: data.aboutArticleId,
      userId: data.userId,
      userName: data.userName,
    }),
    CommentRepo.getAllCommentsCount(context.db, {
      status: data.status,
      postId: data.postId,
      momentId: data.momentId,
      aboutArticleId: data.aboutArticleId,
      userId: data.userId,
      userName: data.userName,
    }),
  ]);

  return { items, total };
}

export async function moderateComment(
  context: DbContext & { executionCtx: ExecutionContext },
  data: ModerateCommentInput,
  moderatorUserId?: string,
) {
  const comment = await CommentRepo.findCommentById(context.db, data.id);

  if (!comment) {
    return err({ reason: "COMMENT_NOT_FOUND" });
  }

  const updatedComment = await CommentRepo.updateComment(context.db, data.id, {
    status: data.status,
  });

  // Send reply notification when manually approving a reply comment
  // Guard: only on first approval (comment.status !== "published") to prevent duplicates
  if (
    data.status === "published" &&
    comment.status !== "published" &&
    comment.replyToCommentId
  ) {
    await sendReplyNotificationForTarget(context, comment, moderatorUserId);
  }

  return ok(updatedComment);
}

export async function adminDeleteComment(
  context: DbContext,
  data: DeleteCommentInput,
) {
  const comment = await CommentRepo.findCommentById(context.db, data.id);

  if (!comment) {
    return err({ reason: "COMMENT_NOT_FOUND" });
  }

  // Hard delete for admin
  await CommentRepo.deleteComment(context.db, data.id);

  return ok({ success: true });
}

// ============ Workflow Methods ============

export async function startCommentModerationWorkflow(
  context: DbContext,
  data: StartCommentModerationInput,
) {
  await context.env.COMMENT_MODERATION_WORKFLOW.create({
    params: {
      commentId: data.commentId,
    },
  });
}

export async function findCommentById(context: DbContext, commentId: number) {
  return await CommentRepo.findCommentById(context.db, commentId);
}

export async function updateCommentStatus(
  context: DbContext,
  commentId: number,
  status: "published" | "pending" | "deleted" | "blocked",
  aiReason?: string,
) {
  return await CommentRepo.updateComment(context.db, commentId, {
    status,
    aiReason,
  });
}

export async function getUserCommentStats(context: DbContext, userId: string) {
  return await CommentRepo.getUserCommentStats(context.db, userId);
}
