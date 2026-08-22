import { ClientOnly } from "@tanstack/react-router";
import { ChevronDown, FolderPlus, Home, Loader2, X } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { MediaFolder } from "../types";
import type { UploadItem } from "../types";

interface UploadModalProps {
  isOpen: boolean;
  queue: Array<UploadItem>;
  isDragging: boolean;
  selectedFolder?: string;
  folders?: MediaFolder[];
  /** 当前渠道上传大小上限（字节）；null = 无固定上限 */
  maxFileSizeBytes?: number | null;
  onFolderChange?: (folder: string) => void;
  onClose: () => void;
  onFileSelect: (files: Array<File>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

function UploadModalInternal({
  isOpen,
  queue,
  isDragging,
  selectedFolder,
  folders = [],
  maxFileSizeBytes = null,
  onFolderChange,
  onClose,
  onFileSelect,
  onDragOver,
  onDragLeave,
  onDrop,
}: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const limitMb =
    maxFileSizeBytes !== null
      ? Math.round(maxFileSizeBytes / 1024 / 1024)
      : null;

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      onFileSelect(Array.from(event.target.files));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isAllComplete =
    queue.length > 0 &&
    queue.every((i) => i.status === "COMPLETE" || i.status === "ERROR");
  const hasErrors = queue.some((i) => i.status === "ERROR");

  const folderLabel = selectedFolder
    ? `/${selectedFolder}`
    : "/";

  return createPortal(
    <div
      className={`fixed inset-0 z-100 flex items-center justify-center p-4 md:p-6 transition-all duration-300 ${
        isOpen
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className={`
          relative w-full max-w-md bg-background border border-border/30
          flex flex-col transform transition-all duration-300 max-h-[85vh]
          ${isOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}
        `}
      >
        {/* Header */}
        <div className="px-6 pt-8 pb-4 flex items-start justify-between shrink-0">
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
              [ {m.media_upload_modal_tag()} ]
            </p>
            <h2 className="text-2xl font-serif font-medium text-foreground">
              {m.media_upload_modal_title()}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleInputChange}
          className="hidden"
          multiple
        />

        {/* Body */}
        <div className="px-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 min-h-0 pb-2">
          {/* Folder Selector */}
          {onFolderChange && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setFolderDropdownOpen(!folderDropdownOpen)}
                className="w-full flex items-center gap-2 border border-border/30 bg-muted/5 px-3 py-2 hover:bg-muted/10 transition-colors"
              >
                <FolderPlus size={12} className="text-muted-foreground shrink-0" />
                <span className="text-xs font-mono text-muted-foreground truncate flex-1 text-left">
                  {m.media_upload_target_folder()}: {folderLabel}
                </span>
                <ChevronDown
                  size={12}
                  className={cn(
                    "text-muted-foreground transition-transform shrink-0",
                    folderDropdownOpen && "rotate-180",
                  )}
                />
              </button>

              {folderDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-border/30 bg-background shadow-md max-h-48 overflow-y-auto custom-scrollbar">
                  <button
                    type="button"
                    onClick={() => {
                      onFolderChange("");
                      setFolderDropdownOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-mono transition-all",
                      !selectedFolder
                        ? "bg-foreground text-background"
                        : "hover:bg-muted/20 text-foreground",
                    )}
                  >
                    <Home size={10} strokeWidth={1.5} />
                    <span>/ (根目录)</span>
                  </button>
                  {folders.map((folder) => (
                    <button
                      key={folder.key}
                      type="button"
                      onClick={() => {
                        onFolderChange(folder.key);
                        setFolderDropdownOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-mono transition-all",
                        selectedFolder === folder.key
                          ? "bg-foreground text-background"
                          : "hover:bg-muted/20 text-foreground",
                      )}
                    >
                      <FolderPlus size={10} strokeWidth={1.5} />
                      <span className="truncate">/{folder.name}</span>
                    </button>
                  ))}
                  {folders.length === 0 && (
                    <div className="px-3 py-2 text-xs font-mono text-muted-foreground/60">
                      {m.media_empty_provider()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Drop Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`
              relative border border-dashed py-8 px-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-300
              ${
                isDragging
                  ? "border-foreground bg-accent/20"
                  : "border-border/50 hover:border-foreground/50 hover:bg-accent/5"
              }
            `}
          >
            <div className="text-center space-y-2">
              <p className="text-xs font-mono uppercase tracking-widest text-foreground">
                {isDragging
                  ? m.media_upload_drop_release()
                  : m.media_upload_drop_here()}
              </p>
              <p className="text-xs font-mono text-muted-foreground/60">
                {limitMb !== null
                  ? m.media_upload_support_any_file_limited({ limit: String(limitMb) })
                  : m.media_upload_support_any_file()}
              </p>
              {limitMb !== null && (
                <p className="text-xs text-red-500 max-w-xs mx-auto">
                  {m.media_upload_oversize_hint()}
                </p>
              )}
            </div>
          </div>

          {/* Queue List */}
          {queue.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/30 pb-2">
                <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
                  {m.media_upload_queue({ count: queue.length })}
                </span>
              </div>

              <div className="space-y-2">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="group bg-background p-3 border border-border/30 flex flex-col gap-2 transition-all hover:border-border/60"
                  >
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="truncate max-w-40 text-foreground font-medium">
                        {item.name}
                      </span>
                      <span className="text-muted-foreground/70">
                        {item.size}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative h-1 w-full bg-muted/30 overflow-hidden">
                      <div
                        className={`absolute top-0 left-0 h-full transition-all duration-300 ${
                          item.status === "COMPLETE"
                            ? "bg-emerald-500"
                            : item.status === "ERROR"
                              ? "bg-destructive"
                              : "bg-foreground"
                        }`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-xs font-mono tracking-widest mt-1">
                      <div className="flex items-center gap-2">
                        {item.status === "UPLOADING" && (
                          <Loader2
                            size={10}
                            className="animate-spin text-foreground"
                          />
                        )}
                        <span
                          className={`uppercase ${
                            item.status === "ERROR"
                              ? "text-destructive"
                              : item.status === "COMPLETE"
                                ? "text-emerald-500"
                                : "text-muted-foreground/70"
                          }`}
                        >
                          {item.status === "COMPLETE"
                            ? m.media_upload_status_complete()
                            : item.status === "ERROR"
                              ? m.media_upload_status_error()
                              : item.status === "UPLOADING"
                                ? m.media_upload_status_uploading()
                                : m.media_upload_status_waiting()}
                        </span>
                      </div>
                      {item.log && (
                        <span
                          className={`max-w-37.5 truncate normal-case tracking-normal ${item.status === "ERROR" ? "text-destructive/80" : "text-muted-foreground/50"}`}
                        >
                          {item.log.replace(/^>\s*/, "")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 flex justify-end gap-3 shrink-0">
          {queue.length > 0 && !isAllComplete && (
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-mono uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              {m.media_upload_btn_background()}
            </button>
          )}

          {isAllComplete ? (
            <button
              onClick={onClose}
              className={`
                px-6 py-2.5 text-xs font-mono uppercase tracking-widest transition-all
                ${
                  hasErrors
                    ? "bg-destructive text-destructive-foreground hover:opacity-80"
                    : "bg-foreground text-background hover:opacity-80"
                }
              `}
            >
              {hasErrors
                ? m.media_upload_btn_confirm_errors()
                : m.media_upload_btn_complete()}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-mono uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              {m.media_upload_btn_cancel()}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function UploadModal(props: UploadModalProps) {
  return (
    <ClientOnly>
      <UploadModalInternal {...props} />
    </ClientOnly>
  );
}
