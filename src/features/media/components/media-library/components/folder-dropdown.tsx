import {
  Check,
  ChevronDown,
  ChevronRight,
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
  /** 打开面板时初始展示的子文件夹（一般来自网格当前目录） */
  folders: MediaFolder[];
  /** 触发按钮前缀文案（如“目标文件夹”/“移动到”） */
  labelPrefix: string;
  onChange: (folder: string) => void;
  /** 内联新建文件夹：成功返回新文件夹 key，失败返回 falsy。parent 为新建时所在目录 */
  onCreateFolder?: (
    name: string,
    parent: string,
  ) => Promise<string | undefined>;
  isCreatingFolder?: boolean;
  disabled?: boolean;
  /** 面板打开时初始浏览路径（如当前目录），驱动逐级下钻 */
  startFolder?: string;
  /** 加载指定目录的子文件夹；提供后启用逐级下钻导航 */
  loadFolders?: (folder: string) => Promise<MediaFolder[]>;
}

const stripSlashes = (p: string) => p.replace(/^\/+|\/+$/g, "");

export function FolderDropdown({
  value,
  folders,
  labelPrefix,
  onChange,
  onCreateFolder,
  isCreatingFolder,
  disabled = false,
  startFolder,
  loadFolders,
}: FolderDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [viewPath, setViewPath] = useState("");
  const [viewFolders, setViewFolders] = useState<MediaFolder[]>([]);
  const [loading, setLoading] = useState(false);

  const drilldown = Boolean(loadFolders);
  const valueLabel = value ? `/${value}` : "/";

  const openPanel = () => {
    setIsOpen(true);
    setViewPath(startFolder ?? "");
    setViewFolders(folders);
    setCreateOpen(false);
    setCreateName("");
    setLoading(false);
  };

  const navTo = async (path: string) => {
    setViewPath(path);
    if (!loadFolders) return;
    setLoading(true);
    try {
      const res = await loadFolders(path);
      setViewFolders(res ?? []);
    } catch {
      setViewFolders([]);
    } finally {
      setLoading(false);
    }
  };

  const selectCurrent = () => {
    onChange(viewPath === "" ? "" : viewPath);
    setIsOpen(false);
  };

  const submitCreate = async () => {
    const name = createName.replace(/^\/+|\/+$/g, "").trim();
    if (!name || !onCreateFolder || isCreatingFolder) return;
    const key = await onCreateFolder(name, viewPath);
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

  const pathClass = cn(
    drilldown ? "mb-1" : "mr-1",
    isFuwari
      ? "text-sm fuwari-text-75"
      : "text-xs font-mono text-muted-foreground",
  );

  const breadcrumbPath = viewPath ? `/${viewPath}` : "/";
  const breadcrumbParts = stripSlashes(viewPath).split("/").filter(Boolean);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={isOpen ? () => setIsOpen(false) : openPanel}
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
          {/* 面包屑导航标题 */}
          {drilldown && (
            <div className={cn("px-3 flex items-center gap-1", pathClass)}>
              <button
                type="button"
                onClick={() => navTo("")}
                title={m.media_folder_root()}
                className={cn(
                  "flex items-center gap-1",
                  isFuwari
                    ? "hover:text-(--fuwari-primary)"
                    : "hover:text-foreground",
                )}
              >
                <Home size={isFuwari ? 13 : 11} strokeWidth={1.5} />
                <span className="max-w-16 truncate">
                  {m.media_folder_root()}
                </span>
              </button>
              {breadcrumbParts.map((part, index) => {
                const prefix =
                  breadcrumbParts.slice(0, index + 1).join("/") + "/";
                const active = index === breadcrumbParts.length - 1;
                return (
                  <span
                    key={`${part}-${index}`}
                    className="flex items-center gap-1 min-w-0"
                  >
                    <ChevronRight
                      size={12}
                      className={cn(
                        "shrink-0",
                        isFuwari
                          ? "fuwari-text-30"
                          : "text-muted-foreground/50",
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => navTo(prefix)}
                      className={cn(
                        "truncate",
                        isFuwari
                          ? "hover:text-(--fuwari-primary)"
                          : "hover:text-foreground",
                        active &&
                          (isFuwari ? "fuwari-text-90" : "text-foreground"),
                      )}
                    >
                      {part}
                    </button>
                  </span>
                );
              })}
              <span className="ml-auto shrink-0 text-xs text-muted-foreground/60">
                {breadcrumbPath}
              </span>
            </div>
          )}

          {/* 选择当前目录 */}
          {drilldown && (
            <button
              type="button"
              onClick={selectCurrent}
              className={cn(
                rowClass(
                  value !== "" &&
                    value.replace(/\/+$/, "") === stripSlashes(viewPath),
                ),
                isFuwari
                  ? "border-t border-(--fuwari-input-border)"
                  : "border-t border-border/30",
              )}
            >
              <Check size={isFuwari ? 14 : 12} strokeWidth={2} />
              <span className="truncate">{m.media_folder_select_here()}</span>
            </button>
          )}

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

          {(drilldown ? viewFolders : folders).map((folder) => (
            <button
              key={folder.key}
              type="button"
              onClick={() => {
                if (drilldown) {
                  navTo(folder.key);
                } else {
                  onChange(folder.key);
                  setIsOpen(false);
                }
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

          {drilldown && loading && (
            <div className={cn("px-3 py-2 flex items-center gap-2", pathClass)}>
              <Loader2 size={12} className="animate-spin" />
              <span>{m.media_folder_loading()}</span>
            </div>
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

          {(drilldown ? viewFolders : folders).length === 0 && !loading && (
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
