import { ClientOnly } from "@tanstack/react-router";
import { FolderInput, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { isFuwari } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";
import type { MediaFolder } from "../types";
import { FolderDropdown } from "./folder-dropdown";

interface MoveModalProps {
  isOpen: boolean;
  /** 待移动文件数 */
  fileCount: number;
  /** 因仅移动文件而跳过的文件夹数 */
  skippedFolderCount: number;
  folders: MediaFolder[];
  currentFolder: string;
  onCreateFolder?: (
    name: string,
    parent: string,
  ) => Promise<string | undefined>;
  isCreatingFolder?: boolean;
  startFolder?: string;
  loadFolders?: (folder: string) => Promise<MediaFolder[]>;
  onSubmit: (targetFolder: string) => Promise<void>;
  onClose: () => void;
  isSubmitting?: boolean;
}

function MoveModalInternal({
  isOpen,
  fileCount,
  skippedFolderCount,
  folders,
  currentFolder,
  onCreateFolder,
  isCreatingFolder,
  startFolder,
  loadFolders,
  onSubmit,
  onClose,
  isSubmitting,
}: MoveModalProps) {
  const [targetFolder, setTargetFolder] = useState("");

  useEffect(() => {
    if (isOpen) setTargetFolder("");
  }, [isOpen]);

  const noOp =
    targetFolder.replace(/\/+$/, "") === currentFolder.replace(/\/+$/, "");
  const canSubmit = fileCount > 0 && !noOp && !isSubmitting;

  const submit = async () => {
    if (!canSubmit) return;
    await onSubmit(targetFolder);
  };

  if (isFuwari) {
    return createPortal(
      <div
        className={`fixed inset-0 z-100 flex items-center justify-center p-4 transition-all duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-sm dark:bg-black/40"
          onClick={onClose}
        />

        <div
          className={`
            relative w-full max-w-md fuwari-card-base shadow-2xl
            flex flex-col transform transition-all duration-300
            ${isOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}
          `}
        >
          <div className="px-6 pt-6 pb-4 flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-bold fuwari-text-90">
                {m.media_move_modal_title()}
              </h2>
              {fileCount > 0 && (
                <p className="text-sm fuwari-text-50">
                  {m.media_move_modal_summary({ count: fileCount })}
                </p>
              )}
              {skippedFolderCount > 0 && (
                <p className="text-xs fuwari-text-30">
                  {m.media_move_modal_skip_folders({
                    count: skippedFolderCount,
                  })}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 fuwari-text-50 hover:text-(--fuwari-primary) transition-colors"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div className="px-6 py-4 space-y-4">
            <FolderDropdown
              value={targetFolder}
              folders={folders}
              labelPrefix={m.media_move_modal_target_label()}
              onChange={setTargetFolder}
              onCreateFolder={onCreateFolder}
              isCreatingFolder={isCreatingFolder}
              startFolder={startFolder}
              loadFolders={loadFolders}
            />
          </div>

          <div className="px-6 pb-6 pt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {m.media_folder_btn_cancel()}
            </Button>
            <Button onClick={submit} disabled={!canSubmit} className="gap-2">
              {isSubmitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FolderInput size={14} />
              )}
              {m.media_move_modal_confirm_btn()}
            </Button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-100 flex items-center justify-center p-4 transition-all duration-300 ${
        isOpen
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`
          relative w-full max-w-md bg-background border border-border/30
          flex flex-col transform transition-all duration-300
          ${isOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}
        `}
      >
        <div className="px-6 pt-8 pb-4 flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
              [ {m.media_move_modal_tag()} ]
            </p>
            <h2 className="text-2xl font-serif font-medium text-foreground">
              {m.media_move_modal_title()}
            </h2>
            {fileCount > 0 && (
              <p className="text-xs font-mono text-muted-foreground/60">
                {m.media_move_modal_summary({ count: fileCount })}
              </p>
            )}
            {skippedFolderCount > 0 && (
              <p className="text-xs font-mono text-muted-foreground/40">
                {m.media_move_modal_skip_folders({ count: skippedFolderCount })}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <FolderDropdown
            value={targetFolder}
            folders={folders}
            labelPrefix={m.media_move_modal_target_label()}
            onChange={setTargetFolder}
            onCreateFolder={onCreateFolder}
            isCreatingFolder={isCreatingFolder}
            startFolder={startFolder}
            loadFolders={loadFolders}
          />
        </div>

        <div className="px-6 pb-6 pt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-mono uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            {m.media_folder_btn_cancel()}
          </button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="h-10 px-6 text-[11px] uppercase tracking-[0.2em] font-medium rounded-none gap-2 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40"
          >
            {isSubmitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FolderInput size={14} />
            )}
            {m.media_move_modal_confirm_btn()}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function MoveModal(props: MoveModalProps) {
  return (
    <ClientOnly>
      <MoveModalInternal {...props} />
    </ClientOnly>
  );
}
