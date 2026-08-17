import { ClientOnly } from "@tanstack/react-router";
import type { JSONContent } from "@tiptap/react";
import { Heart, Loader2, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { MomentEditor } from "@/features/moments/components/moment-editor";
import { collectImageUrls } from "@/features/moments/components/moment-editor-config";
import type { MomentWithStats } from "@/features/moments/moments.schema";
import { cn, formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { renderCommentReact } from "../../components/comments/view/comment-render";
import { CommentSection } from "../../components/comments/view/comment-section";

interface MomentCardProps {
  moment: MomentWithStats;
  isAdmin: boolean;
  onToggleLike: (momentId: number) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
  onUpdate: (
    id: number,
    content: JSONContent,
    images: string[],
  ) => Promise<boolean>;
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
  isAdmin,
  onToggleLike,
  onDelete,
  onUpdate,
}: MomentCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [liking, setLiking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(moment.id);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleEditSubmit = async (content: JSONContent): Promise<boolean> => {
    if (isSubmitting) return false;
    const images = collectImageUrls(content);
    setIsSubmitting(true);
    try {
      const ok = await onUpdate(moment.id, content, images);
      if (ok) setEditing(false);
      return ok;
    } finally {
      setIsSubmitting(false);
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
          <div className="flex items-center gap-1">
            {!editing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
                className="h-auto p-1 text-muted-foreground/40 hover:text-foreground bg-transparent hover:bg-transparent"
              >
                <Pencil size={14} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              className="h-auto p-1 text-muted-foreground/40 hover:text-destructive bg-transparent hover:bg-transparent"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        )}
      </header>

      {/* Content / Editor */}
      {editing ? (
        <div className="px-6 pt-4">
          <MomentEditor
            onSubmit={handleEditSubmit}
            isSubmitting={isSubmitting}
            initialContent={moment.content}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
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
      )}

      {/* Images */}
      {moment.images.length > 0 && !editing && (
        <div
          className={cn(
            "px-6 pt-4 grid gap-2",
            moment.images.length === 1
              ? "grid-cols-1"
              : moment.images.length === 2
                ? "grid-cols-1 sm:grid-cols-2"
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
      {!editing && (
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
      )}

      {/* Comments */}
      {commentsOpen && !editing && (
        <div className="border-t border-border/10 px-6 py-5">
          <CommentSection momentId={moment.id} />
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
