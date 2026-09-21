import {
  Check,
  ChevronDown,
  FolderPlus,
  Home,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { MediaFolder } from "../types";
import { PortalPanel } from "./portal-panel";

interface FolderDropdownProps {
  /** 当前选择的文件夹（相对路径，可含尾斜杠）；空串 = 根目录 */
  value: string;
  folders: MediaFolder[];
  /** 触发按钮前缀文案（如“目标文件夹”/“移动到”） */
  labelPrefix: string;
  onChange: (folder: string) => void;
  /** 内联新建文件夹：成功返回新文件夹 key，失败返回 falsy */
  onCreateFolder?: (name: string) => Promise<string | undefined>;
  isCreatingFolder?: boolean;
  allowRoot?: boolean;
  disabled?: boolean;
}

export function FolderDropdown({
  value,
  folders,
  labelPrefix,
  onChange,
  onCreateFolder,
  isCreatingFolder,
  allowRoot = true,
  disabled = false,
}: FolderDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");

  const valueLabel = value ? `/${value}` : "/";

  const submitCreate = async () => {
    const name = createName.replace(/^\/+|\/+$/g, "").trim();
    if (!name || !onCreateFolder || isCreatingFolder) return;
    const key = await onCreateFolder(name);
    if (key) {
      onChange(key);
      setCreateOpen(false);
      setCreateName("");
      setIsOpen(false);
    }
  };

  const rowClass = (active: boolean) =>
    cn(
      "flex items-center gap-2 w-full px-3 py-2 text-left transition-all",
      isFuwari ? "rounded-lg text-sm" : "text-xs font-mono",
      active
        ? isFuwari
          ? "bg-(--fuwari-primary)/10 text-(--fuwari-primary) font-semibold"
          : "bg-foreground text-background"
        : isFuwari
          ? "fuwari-text-75 hover:bg-(--fuwari-btn-plain-bg-hover) hover:text-(--fuwari-primary)"
          : "hover:bg-muted/20 text-foreground",
    );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-2 transition-colors",
          isFuwari
            ? "fuwari-btn-regular rounded-xl px-3 py-2.5 hover:border-(--fuwari-primary)/50"
            : "border border-border/30 bg-muted/5 px-3 py-2 hover:bg-muted/10 disabled:opacity-40",
        )}
      >
        <FolderPlus
          size={isFuwari ? 14 : 12}
          strokeWidth={1.5}
          className={cn(
            "shrink-0",
            isFuwari ? "fuwari-text-50" : "text-muted-foreground",
          )}
        />
        <span
          className={cn(
            "truncate flex-1 text-left",
            isFuwari
              ? "text-sm fuwari-text-75"
              : "text-xs font-mono text-muted-foreground",
          )}
        >
          {labelPrefix}: {valueLabel}
        </span>
        <ChevronDown
          size={12}
          className={cn(
            "shrink-0 transition-transform",
            isFuwari ? "fuwari-text-30" : "text-muted-foreground",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <PortalPanel
          triggerRef={triggerRef}
          onClose={() => setIsOpen(false)}
          minWidth={240}
          className={cn(
            "max-h-64 overflow-y-auto custom-scrollbar",
            isFuwari
              ? "fuwari-card-base p-1.5 shadow-lg animate-in fade-in-0 zoom-in-95"
              : "border border-border/30 bg-background shadow-md",
          )}
        >
          {allowRoot && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
              className={rowClass(!value)}
            >
              <Home size={isFuwari ? 14 : 12} strokeWidth={1.5} />
              <span>{m.media_folder_root()}</span>
            </button>
          )}

          {folders.map((folder) => (
            <button
              key={folder.key}
              type="button"
              onClick={() => {
                onChange(folder.key);
                setIsOpen(false);
              }}
              className={rowClass(
                value !== "" &&
                  value.replace(/\/+$/, "") === folder.key.replace(/\/+$/, ""),
              )}
            >
              <FolderPlus size={isFuwari ? 14 : 12} strokeWidth={1.5} />
              <span className="truncate">/{folder.name}</span>
            </button>
          ))}

          {onCreateFolder && !createOpen && (
            <button
              type="button"
              onClick={() => {
                setCreateOpen(true);
                requestAnimationFrame(() => createInputRef.current?.focus());
              }}
              className={cn(
                rowClass(false),
                isFuwari
                  ? "border-t border-(--fuwari-input-border) mt-1.5 pt-2"
                  : "border-t border-border/30 mt-1.5 pt-2",
              )}
            >
              <Plus size={isFuwari ? 14 : 12} strokeWidth={1.5} />
              <span>{m.media_upload_inline_create_folder()}</span>
            </button>
          )}

          {onCreateFolder && createOpen && (
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-2",
                isFuwari
                  ? "border-t border-(--fuwari-input-border) mt-1.5"
                  : "border-t border-border/30 mt-1.5",
              )}
            >
              <Input
                ref={createInputRef}
                type="text"
                value={createName}
                placeholder={m.media_upload_inline_create_placeholder()}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitCreate();
                  if (e.key === "Escape") {
                    setCreateOpen(false);
                    setCreateName("");
                  }
                }}
                className={cn(
                  "flex-1",
                  isFuwari
                    ? ""
                    : "h-8 text-xs font-mono rounded-none bg-transparent border-border/30",
                )}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={submitCreate}
                disabled={isCreatingFolder || !createName.trim()}
                className={cn(
                  "h-8 w-8 shrink-0",
                  isFuwari ? "" : "rounded-none",
                )}
                title={m.media_folder_create_btn()}
              >
                {isCreatingFolder ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  setCreateOpen(false);
                  setCreateName("");
                }}
                className={cn(
                  "h-8 w-8 shrink-0",
                  isFuwari ? "" : "rounded-none",
                )}
              >
                <X size={14} />
              </Button>
            </div>
          )}

          {folders.length === 0 && !onCreateFolder && (
            <div
              className={cn(
                "px-3 py-2",
                isFuwari
                  ? "text-sm fuwari-text-30"
                  : "text-xs font-mono text-muted-foreground/60",
              )}
            >
              {m.media_empty_provider()}
            </div>
          )}
        </PortalPanel>
      )}
    </>
  );
}
