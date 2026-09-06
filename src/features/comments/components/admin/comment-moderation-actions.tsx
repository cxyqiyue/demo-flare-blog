import {
  Ban,
  Check,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { isFuwari } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";
import { useAdminComments } from "../../hooks/use-comments";

interface CommentModerationActionsProps {
  commentId: number;
  status: string;
}

export const CommentModerationActions = ({
  commentId,
  status,
}: CommentModerationActionsProps) => {
  const { moderate, adminDelete, isModerating, isAdminDeleting } =
    useAdminComments();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStatusChange = (
    newStatus: "published" | "pending" | "deleted" | "blocked",
  ) => {
    setIsOpen(false);
    moderate({ data: { id: commentId, status: newStatus } });
  };

  const confirmDelete = () => {
    adminDelete(
      { data: { id: commentId } },
      { onSuccess: () => setShowDeleteConfirm(false) },
    );
  };

  const isLoading = isModerating || isAdminDeleting;

  if (isFuwari) {
    return (
      <>
        <div className="flex items-center justify-end relative" ref={menuRef}>
          <button
            className="fuwari-btn-regular rounded-lg h-9 w-9 active:scale-90 hover:text-(--fuwari-primary) transition-colors disabled:opacity-40"
            disabled={isLoading}
            onClick={() => setIsOpen(!isOpen)}
            title={m.comments_action_btn()}
            aria-label={m.comments_action_btn()}
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <MoreHorizontal size={16} strokeWidth={1.5} />
            )}
          </button>

          {isOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 fuwari-card-base p-1.5 z-50 shadow-lg animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-0.5">
                {status !== "published" && (
                  <button
                    onClick={() => handleStatusChange("published")}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm fuwari-text-75 text-left hover:bg-(--fuwari-btn-regular-bg) hover:text-(--fuwari-primary) transition-colors"
                  >
                    <span>{m.comments_action_approve()}</span>
                    <Check className="h-3.5 w-3.5 fuwari-text-30 shrink-0" />
                  </button>
                )}

                {status !== "pending" && (
                  <button
                    onClick={() => handleStatusChange("pending")}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm fuwari-text-75 text-left hover:bg-(--fuwari-btn-regular-bg) hover:text-(--fuwari-primary) transition-colors"
                  >
                    <span>{m.comments_action_pending()}</span>
                    <RotateCcw className="h-3.5 w-3.5 fuwari-text-30 shrink-0" />
                  </button>
                )}

                {status !== "blocked" && (
                  <button
                    onClick={() => handleStatusChange("blocked")}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left fuwari-text-75 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                  >
                    <span>{m.comments_action_block()}</span>
                    <Ban className="h-3.5 w-3.5 fuwari-text-30 shrink-0" />
                  </button>
                )}

                {status !== "deleted" && (
                  <button
                    onClick={() => handleStatusChange("deleted")}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left fuwari-text-75 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                  >
                    <span>{m.comments_action_trash()}</span>
                    <Trash2 className="h-3.5 w-3.5 fuwari-text-30 shrink-0" />
                  </button>
                )}
              </div>

              <div className="h-px bg-(--fuwari-input-border) my-1.5" />

              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowDeleteConfirm(true);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <span>{m.comments_action_destroy()}</span>
                <ShieldAlert className="h-3.5 w-3.5 fuwari-text-30 shrink-0" />
              </button>
            </div>
          )}
        </div>

        <ConfirmationModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDelete}
          title={m.comments_destroy_modal_title()}
          message={m.comments_destroy_modal_desc()}
          confirmLabel={m.comments_destroy_modal_confirm()}
          isDanger={true}
          isLoading={isAdminDeleting}
        />
      </>
    );
  }

  return (
    <div className="flex items-center justify-end relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-auto px-2 text-[10px] font-mono text-muted-foreground hover:text-foreground rounded-none gap-1"
        disabled={isLoading}
        onClick={() => setIsOpen(!isOpen)}
        title={m.comments_action_btn()}
      >
        {isLoading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <span>[ {m.comments_action_btn()} ]</span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-background border border-border/30 z-50 p-1 animate-in fade-in zoom-in-95 duration-200">
          <div className="space-y-0.5">
            {status !== "published" && (
              <button
                onClick={() => handleStatusChange("published")}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono text-left hover:bg-muted/10 transition-colors text-foreground group"
              >
                <span>{m.comments_action_approve()}</span>
                <Check className="h-3 w-3 opacity-0 group-hover:opacity-100" />
              </button>
            )}

            {status !== "pending" && (
              <button
                onClick={() => handleStatusChange("pending")}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono text-left hover:bg-muted/10 transition-colors text-foreground group"
              >
                <span>{m.comments_action_pending()}</span>
                <RotateCcw className="h-3 w-3 opacity-0 group-hover:opacity-100" />
              </button>
            )}

            {status !== "blocked" && (
              <button
                onClick={() => handleStatusChange("blocked")}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono text-left hover:bg-red-500/10 transition-colors text-red-500 group"
              >
                <span>{m.comments_action_block()}</span>
                <Ban className="h-3 w-3 opacity-0 group-hover:opacity-100" />
              </button>
            )}

            {status !== "deleted" && (
              <button
                onClick={() => handleStatusChange("deleted")}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono text-left hover:bg-muted/10 transition-colors text-muted-foreground hover:text-red-500 group"
              >
                <span>{m.comments_action_trash()}</span>
                <Trash2 className="h-3 w-3 opacity-0 group-hover:opacity-100" />
              </button>
            )}
          </div>

          <div className="h-px bg-border/30 my-1" />

          <button
            onClick={() => {
              setIsOpen(false);
              setShowDeleteConfirm(true);
            }}
            className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono text-left hover:bg-red-500/10 text-red-500 transition-colors group"
          >
            <span>{m.comments_action_destroy()}</span>
            <ShieldAlert className="h-3 w-3 opacity-0 group-hover:opacity-100" />
          </button>
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title={m.comments_destroy_modal_title()}
        message={m.comments_destroy_modal_desc()}
        confirmLabel={m.comments_destroy_modal_confirm()}
        isDanger={true}
        isLoading={isAdminDeleting}
      />
    </div>
  );
};
