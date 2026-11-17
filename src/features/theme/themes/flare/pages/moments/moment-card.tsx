import { ClientOnly, useSearch } from "@tanstack/react-router";
import type { JSONContent } from "@tiptap/react";
import {
  Heart,
  Loader2,
  MessageCircle,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { collectImageUrls } from "@/features/moments/components/moment-editor-config";
import type { MomentWithStats } from "@/features/moments/moments.schema";
import { MomentVideoUrlSchema } from "@/features/moments/moments.schema";
import { cn, formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { renderCommentReact } from "../../components/comments/view/comment-render";
import { CommentSection } from "../../components/comments/view/comment-section";
import { MomentVideo } from "./moment-video";

// TipTap 编辑器体积大，且仅在管理员编辑动态时挂载，按需加载
const MomentEditor = lazy(() =>
  import("@/features/moments/components/moment-editor").then((mod) => ({
    default: mod.MomentEditor,
  })),
);

interface MomentCardProps {
  moment: MomentWithStats;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  currentUserId?: string | null;
  onToggleLike: (momentId: number) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
  onUpdate: (
    id: number,
    content: JSONContent,
    images: string[],
    videoUrl?: string | null,
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
  isSuperAdmin,
  currentUserId,
  onToggleLike,
  onDelete,
  onUpdate,
}: MomentCardProps) {
  const search = useSearch({ strict: false });
  const [commentsOpen, setCommentsOpen] = useState(
    Boolean(search.highlightCommentId && search.momentId === moment.id),
  );
  const [liking, setLiking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoUrl, setVideoUrl] = useState(moment.videoUrl ?? "");
  useEffect(() => {
    if (search.highlightCommentId && search.momentId === moment.id)
      setCommentsOpen(true);
  }, [search.highlightCommentId, search.momentId, moment.id]);

  // 超管可管理所有动态；普通管理员仅可管理自己发布的动态
  const canManage =
    isAdmin && (isSuperAdmin || moment.authorUserId === currentUserId);

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
    const parsed = MomentVideoUrlSchema.safeParse(videoUrl.trim() || null);
    if (!parsed.success) {
      toast.error("请输入有效的视频链接");
      return false;
    }
    const images = collectImageUrls(content);
    setIsSubmitting(true);
    try {
      const ok = await onUpdate(moment.id, content, images, parsed.data);
      if (ok) setEditing(false);
      return ok;
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderedContent = renderCommentReact(moment.content);

  return (
    <article
      id={`moment-${moment.id}`}
      className="flare-surface overflow-hidden scroll-mt-24"
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-4 px-5 md:px-6 pt-5 md:pt-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full bg-muted/40 border border-border/40 overflow-hidden flex items-center justify-center shrink-0">
            {moment.author?.image ? (
              <img
                src={moment.author.image}
                alt={moment.author.name ?? ""}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-medium text-muted-foreground uppercase">
                {moment.author?.name?.slice(0, 1) || "?"}
              </span>
            )}
          </div>
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {moment.author?.name || m.moments_anonymous()}
            </p>
            <p className="text-xs text-muted-foreground/70">
              <ClientOnly fallback="-">
                {formatDate(moment.createdAt, { includeTime: true })}
              </ClientOnly>
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-1">
            {!editing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setVideoUrl(moment.videoUrl ?? "");
                  setEditing(true);
                }}
                aria-label={m.announcements_actions_edit()}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <Pencil size={14} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              aria-label={m.announcements_actions_delete()}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        )}
      </header>

      {/* Content / Editor */}
      {editing ? (
        <div className="px-5 md:px-6 pt-4">
          <Suspense fallback={null}>
            <MomentEditor
              onSubmit={handleEditSubmit}
              isSubmitting={isSubmitting}
              initialContent={{
                type: "doc",
                content: [
                  ...(moment.content?.content ?? []),
                  ...moment.images
                    .filter(
                      (src) =>
                        !collectImageUrls(
                          moment.content ?? { type: "doc", content: [] },
                        ).includes(src),
                    )
                    .map((src) => ({
                      type: "image",
                      attrs: { src },
                    })),
                ],
              }}
              allowEmpty={Boolean(videoUrl.trim())}
              onCancel={() => setEditing(false)}
            />
          </Suspense>
          <label className="my-3 flex flex-col gap-2 text-sm">
            视频链接
            <input
              type="url"
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            />
          </label>
        </div>
      ) : (
        <div className="px-5 md:px-6 pt-4">
          {renderedContent ? (
            <div className="flare-md text-sm md:text-[15px] leading-relaxed text-foreground/90">
              {renderedContent}
            </div>
          ) : !moment.videoUrl ? (
            <p className="text-sm text-muted-foreground/60 italic">
              {m.moments_empty_content()}
            </p>
          ) : null}
        </div>
      )}

      {/* Images */}
      {moment.images.length > 0 && !editing && (
        <div
          className={cn(
            "px-5 md:px-6 pt-4 grid gap-2",
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

      {moment.videoUrl && !editing ? (
        <div className="px-5 pt-4 md:px-6">
          <MomentVideo key={moment.videoUrl} url={moment.videoUrl} />
        </div>
      ) : null}

      {/* Actions */}
      {!editing && (
        <footer className="flex items-center gap-4 px-5 md:px-6 pb-5 pt-4 border-t border-border/30 mt-5">
          <button
            type="button"
            onClick={handleToggleLike}
            disabled={liking}
            className="flare-chip disabled:opacity-50"
          >
            {liking ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Heart
                size={14}
                className={cn(isLiked && "fill-current text-red-500")}
              />
            )}
            <span className="tabular-nums">{moment.likeCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setCommentsOpen((open) => !open)}
            className="flare-chip"
            data-active={commentsOpen}
          >
            <MessageCircle size={14} />
            <span className="tabular-nums">{moment.commentCount}</span>
          </button>
          <button
            type="button"
            className="flare-chip ml-auto"
            onClick={async () => {
              const url = new URL(window.location.href);
              url.search = "";
              url.searchParams.set("momentId", String(moment.id));
              url.hash = `moment-${moment.id}`;
              try {
                if (navigator.share)
                  await navigator.share({
                    title: moment.author?.name ?? m.moments_title(),
                    url: url.href,
                  });
                else {
                  await navigator.clipboard.writeText(url.href);
                  toast.success(m.post_share_success());
                }
              } catch (error) {
                if (
                  !(
                    error instanceof DOMException && error.name === "AbortError"
                  )
                )
                  toast.error(m.post_share_error());
              }
            }}
          >
            <Share2 size={14} />
            {m.post_share()}
          </button>
        </footer>
      )}

      {/* Comments */}
      {commentsOpen && !editing && (
        <div className="border-t border-border/30 px-5 md:px-6 py-5 bg-background/20">
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
