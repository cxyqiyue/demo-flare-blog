import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import type { JSONContent } from "@tiptap/react";
import { LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { useComments } from "@/features/comments/hooks/use-comments";
import {
  type CommentTargetInput,
  rootCommentsByTargetInfiniteQuery,
} from "@/features/comments/queries";
import { authClient } from "@/lib/auth/auth.client";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { CommentEditor } from "./comment-editor";
import { CommentList } from "./comment-list";
import { CommentSectionSkeleton } from "./comment-section-skeleton";

interface CommentSectionProps {
  postId?: number;
  momentId?: number;
  aboutArticleId?: number;
  className?: string;
}

export const CommentSection = ({
  postId,
  momentId,
  aboutArticleId,
  className,
}: CommentSectionProps) => {
  const { data: session } = authClient.useSession();
  const target: CommentTargetInput =
    aboutArticleId != null
      ? { aboutArticleId }
      : momentId != null
        ? { momentId }
        : { postId };
  const redirectTo = useRouterState({
    select: (state) => state.location.href,
  });
  const { rootId, highlightCommentId } = useRouterState({
    select: (state) =>
      (state.location.search as {
        rootId?: number;
        highlightCommentId?: number;
      }) ?? {},
  });
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      ...rootCommentsByTargetInfiniteQuery(target, session?.user.id),
      enabled: !!session,
    });

  const rootComments = data?.pages.flatMap((page) => page.items) ?? [];
  const totalCount = data?.pages[0]?.total ?? 0;

  const { createComment, deleteComment, isCreating, isDeleting } =
    useComments(target);

  const [replyTarget, setReplyTarget] = useState<{
    rootId: number;
    commentId: number;
    userName: string;
  } | null>(null);

  const [commentToDelete, setCommentToDelete] = useState<number | null>(null);

  const handleCreateComment = async (
    content: JSONContent,
  ): Promise<boolean> => {
    const result = await createComment({
      data: {
        ...target,
        content,
      },
    });
    // 返回成功与否：编辑器仅在成功时清空内容，失败保留以便重试
    return !result?.error;
  };

  const handleCreateReply = async (content: JSONContent): Promise<boolean> => {
    if (!replyTarget) return false;
    const result = await createComment({
      data: {
        ...target,
        content,
        rootId: replyTarget.rootId,
        replyToCommentId: replyTarget.commentId,
      },
    });
    if (!result?.error) {
      setReplyTarget(null);
    }
    return !result?.error;
  };

  const handleDelete = async () => {
    if (commentToDelete) {
      await deleteComment({ data: { id: commentToDelete } });
      setCommentToDelete(null);
    }
  };

  /* New Enhancement: Handle Anchor Navigation for CSR */
  useEffect(() => {
    if (isLoading || !data) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleAnchor = () => {
      const hash = window.location.hash;
      if (!hash || !hash.startsWith("#comment-")) return;

      const commentId = parseInt(hash.replace("#comment-", ""), 10);
      if (isNaN(commentId)) return;

      // Robust retry mechanism to find the element as it might be rendered after data load/expansion
      let retries = 0;
      const maxRetries = 20;

      const attemptScroll = () => {
        const element = document.getElementById(`comment-${commentId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }

        if (retries < maxRetries) {
          retries++;
          timeoutId = setTimeout(attemptScroll, 200);
        }
      };

      attemptScroll();
    };

    handleAnchor();
    window.addEventListener("hashchange", handleAnchor);
    return () => {
      window.removeEventListener("hashchange", handleAnchor);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoading, data]);

  if (session && (isLoading || !data)) {
    return <CommentSectionSkeleton className={className} />;
  }

  return (
    <section
      className={cn("space-y-8 animate-in fade-in duration-500", className)}
    >
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-lg md:text-xl font-semibold text-foreground">
            {m.comments_count({ count: totalCount })}
          </p>
        </div>
      </header>

      {/* Main Editor */}
      {session ? (
        <div className="space-y-4">
          <CommentEditor
            onSubmit={handleCreateComment}
            isSubmitting={isCreating && !replyTarget}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl py-10 text-center text-card-foreground [background:var(--flare-surface-soft)] [border:1px_solid_var(--flare-border)]">
          <p className="text-sm text-muted-foreground">
            {m.comments_join_discussion()}
          </p>
          <Link
            to="/login"
            search={{ redirectTo }}
            className="flare-chip min-h-11 px-4"
          >
            <LogIn size={14} className="opacity-80" />
            {m.comments_login()}
          </Link>
        </div>
      )}

      {/* Comments List — 仅登录后可见；未登录访客完全封锁评论区内容 */}
      {session && (
        <>
          <CommentList
            rootComments={rootComments}
            target={target}
            onReply={(rootIdArg, commentId, userName) =>
              setReplyTarget({ rootId: rootIdArg, commentId, userName })
            }
            onDelete={(id) => setCommentToDelete(id)}
            replyTarget={replyTarget}
            onCancelReply={() => setReplyTarget(null)}
            onSubmitReply={handleCreateReply}
            isSubmittingReply={isCreating}
            initialExpandedRootId={rootId}
            highlightCommentId={highlightCommentId}
          />

          {/* Load More Root Comments */}
          {hasNextPage && (
            <div className="flex justify-center pt-8">
              <Button
                type="button"
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="min-h-11 px-5 text-sm font-medium transition-all"
              >
                {isFetchingNextPage
                  ? m.comments_loading()
                  : m.comments_load_more()}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!commentToDelete}
        onClose={() => setCommentToDelete(null)}
        onConfirm={handleDelete}
        title={m.comments_delete_title()}
        message={m.comments_delete_desc()}
        confirmLabel={m.comments_delete_confirm()}
        isDanger={true}
        isLoading={isDeleting}
      />
    </section>
  );
};
