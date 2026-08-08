import { ClientOnly } from "@tanstack/react-router";
import { Heart, Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { Input } from "@/components/ui/input";
import type { MomentComment, MomentWithStats } from "@/features/moments/moments.schema";
import { cn, formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { renderCommentReact } from "../../components/comments/view/comment-render";

interface MomentCardProps {
  moment: MomentWithStats;
  currentUserId?: string | null;
  isAdmin: boolean;
  onToggleLike: (momentId: number) => Promise<boolean>;
  onAddComment: (momentId: number, text: string) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
}

function MomentImage({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="w-full h-full object-cover rounded-sm border border-border/40"
    />
  );
}

export function MomentCard({
  moment,
  currentUserId,
  isAdmin,
  onToggleLike,
  onAddComment,
  onDelete,
}: MomentCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [liking, setLiking] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [localComments, setLocalComments] = useState<MomentComment[]>(
    moment.comments,
  );

  useEffect(() => {
    setLocalComments(moment.comments);
  }, [moment.comments]);

  const isLiked = moment.isLiked;

  const handleToggleLike = async () => {
    if (liking) return;
    setLiking(true);
    try {
      await onToggleLike(moment.id);
    } finally {
      setLiking(false);
    }
  };

  const handleAddComment = async () => {
    const text = commentText.trim();
    if (!text || commenting) return;
    setCommenting(true);
    try {
      const ok = await onAddComment(moment.id, text);
      if (ok) setCommentText("");
    } finally {
      setCommenting(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(moment.id);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const renderedContent = renderCommentReact(moment.content);

  return (
    <article className="group border border-border/20 bg-background/50 transition-colors hover:border-border/40">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 px-6 pt-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-muted/30 border border-border/20 overflow-hidden flex items-center justify-center">
            {moment.author?.image ? (
              <img
                src={moment.author.image}
                alt={moment.author.name ?? ""}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[10px] font-mono text-muted-foreground uppercase">
                {moment.author?.name?.slice(0, 1) || "?"}
              </span>
            )}
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-foreground tracking-wide">
              {moment.author?.name || m.moments_anonymous()}
            </p>
            <p className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest">
              <ClientOnly fallback="-">
                {formatDate(moment.createdAt, { includeTime: true })}
              </ClientOnly>
            </p>
          </div>
        </div>

        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
            className="h-auto p-1 text-muted-foreground/40 hover:text-destructive bg-transparent hover:bg-transparent"
          >
            <Trash2 size={14} />
          </Button>
        )}
      </header>

      {/* Content */}
      <div className="px-6 pt-4">
        {renderedContent ? (
          <div className="text-sm leading-relaxed text-foreground/90 font-light">
            {renderedContent}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground/50 font-light italic">
            {m.moments_empty_content()}
          </p>
        )}
      </div>

      {/* Images */}
      {moment.images.length > 0 && (
        <div
          className={cn(
            "px-6 pt-4 grid gap-2",
            moment.images.length === 1
              ? "grid-cols-1"
              : moment.images.length === 2
                ? "grid-cols-2"
                : "grid-cols-2 md:grid-cols-3",
          )}
        >
          {moment.images.map((src, i) => (
            <div key={i} className="min-h-0">
              <MomentImage src={src} />
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <footer className="flex items-center gap-6 px-6 pb-5 pt-5 border-t border-border/10 mt-5">
        <button
          type="button"
          onClick={handleToggleLike}
          disabled={liking}
          className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {liking ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Heart
              size={14}
              className={cn(isLiked && "fill-current text-red-500")}
            />
          )}
          {moment.likeCount}
        </button>

        <button
          type="button"
          onClick={() => setCommentsOpen((open) => !open)}
          className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle size={14} />
          {moment.commentCount}
        </button>
      </footer>

      {/* Comments */}
      {commentsOpen && (
        <div className="border-t border-border/10 px-6 py-5 space-y-4">
          {localComments.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 italic">
              {m.moments_comment_empty()}
            </p>
          ) : (
            <ul className="space-y-4">
              {localComments.map((comment) => (
                <li key={comment.id} className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-muted/30 border border-border/20 overflow-hidden flex items-center justify-center shrink-0">
                    {comment.user?.image ? (
                      <img
                        src={comment.user.image}
                        alt={comment.user.name ?? ""}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[8px] font-mono text-muted-foreground uppercase">
                        {comment.user?.name?.slice(0, 1) || "?"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-foreground">
                        {comment.user?.name || m.moments_anonymous()}
                      </span>
                      <span className="text-[8px] font-mono text-muted-foreground/30 uppercase tracking-widest">
                        <ClientOnly fallback="-">
                          {formatDate(comment.createdAt, { includeTime: true })}
                        </ClientOnly>
                      </span>
                    </div>
                    <div className="text-xs text-foreground/80 font-light leading-relaxed break-words">
                      {renderCommentReact(comment.content)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {currentUserId ? (
            <div className="flex items-center gap-3 pt-1">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleAddComment();
                  }
                }}
                placeholder={m.moments_comment_placeholder()}
                className="flex-1 rounded-none border border-border/30 bg-background/50 px-4 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddComment}
                disabled={commenting || !commentText.trim()}
                className="h-9 rounded-none px-4 text-[10px] font-mono uppercase tracking-widest"
              >
                {commenting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Send size={12} />
                )}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        title={m.moments_delete_confirm_title()}
        message={m.moments_delete_confirm_message()}
        confirmLabel={m.moments_delete_confirm_btn()}
        isDanger
        isLoading={deleting}
      />
    </article>
  );
}
