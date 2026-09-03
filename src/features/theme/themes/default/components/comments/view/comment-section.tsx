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

  const handleCreateReply = async (
    content: JSONContent,
  ): Promise<boolean> => {
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
      className={cn(
        "space-y-12 mt-24 pt-12 border-t border-border/20 animate-in fade-in duration-700",
        className,
      )}
    >
      <header className="flex items-center justify-between">
        <div className="space-y-2">
          <p className="text-xl font-serif font-medium text-foreground">
            {m.comments_count({ count: totalCount })}
          </p>
        </div>
      </header>

      {/* Main Editor */}
      {session ? (
        <div className="space-y-6">
          <CommentEditor
            onSubmit={handleCreateComment}
            isSubmitting={isCreating && !replyTarget}
          />
        </div>
      ) : (
        <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-xs font-mono text-muted-foreground/60 tracking-wider">
            {m.comments_join_discussion()}
          </p>
          <Link to="/login">
            <Button
              variant="outline"
              className="h-10 px-6 text-[10px] uppercase tracking-[0.25em] font-bold border-border/40 bg-transparent hover:bg-foreground hover:text-background transition-all"
            >
              <LogIn size={12} className="mr-2.5 opacity-70" />
              {m.comments_login()}
            </Button>
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
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold border-border hover:bg-foreground hover:text-background transition-all"
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
