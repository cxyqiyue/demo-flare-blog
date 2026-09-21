import {
  ArrowUpDown,
  CheckSquare,
  Copy,
  Filter,
  FolderInput,
  FolderPlus,
  LayoutGrid,
  Link,
  List,
  Search,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import {
  type CopyLinkFormat,
  type MediaSortBy,
  type MediaSortDir,
  formatCopyLink,
} from "@/features/media/utils/media.utils";
import type { MediaFileItem } from "../hooks/use-media-library";
import { PortalPanel } from "./portal-panel";

interface MediaToolbarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  unusedOnly: boolean;
  onUnusedOnlyChange: (val: boolean) => void;
  view: "grid" | "table";
  onViewChange: (val: "grid" | "table") => void;
  selectedCount: number;
  totalCount: number;
  searching: boolean;
  onSelectAll: () => void;
  onDelete: () => void;
  onNewFolder?: () => void;
  onMove?: () => void;
  canMoveFiles?: boolean;
  selectedKeys: Set<string>;
  mediaItems: MediaFileItem[];
  canDelete: boolean;
  sortBy: MediaSortBy;
  sortDir: MediaSortDir;
  onSortChange: (sortBy: MediaSortBy, sortDir: MediaSortDir) => void;
  copyFormat: CopyLinkFormat;
  onCopyFormatChange: (format: CopyLinkFormat) => void;
}

const COPY_FORMATS: Array<{ value: CopyLinkFormat; label: string }> = [
  { value: "url", label: "URL" },
  { value: "markdown", label: "Markdown" },
  { value: "html", label: "HTML" },
  { value: "bbcode", label: "BBCode" },
];

const triggerClass = cn(
  "flex items-center gap-2 whitespace-nowrap cursor-pointer",
  isFuwari
    ? "fuwari-btn-regular rounded-xl px-3 py-2 text-sm hover:border-(--fuwari-primary)/50"
    : "h-10 px-3 text-[11px] uppercase tracking-widest font-mono bg-transparent border border-border/30 text-muted-foreground hover:text-foreground transition-all rounded-none",
);

const menuPanelClass = isFuwari
  ? "fuwari-card-base p-1.5 shadow-lg animate-in fade-in-0 zoom-in-95 max-h-80 overflow-y-auto custom-scrollbar"
  : "bg-popover border border-border/30 py-1 max-h-80 overflow-y-auto custom-scrollbar";

const menuOptionClass = cn(
  "w-full text-left flex items-center gap-2 transition-colors",
  isFuwari
    ? "px-3 py-2 text-sm rounded-lg"
    : "px-3 py-2 text-[9px] font-mono uppercase tracking-widest",
);

function menuOptionActiveClass(isActive: boolean) {
  if (isActive) {
    return isFuwari
      ? "text-(--fuwari-primary) bg-(--fuwari-btn-regular-bg) font-semibold"
      : "bg-foreground text-background hover:bg-foreground/90";
  }
  return isFuwari
    ? "fuwari-text-50 hover:text-(--fuwari-primary) hover:bg-(--fuwari-btn-plain-bg-hover)"
    : "text-muted-foreground/60 hover:text-foreground hover:bg-accent/30";
}

function SortDropdown({
  sortBy,
  sortDir,
  onChange,
}: {
  sortBy: MediaSortBy;
  sortDir: MediaSortDir;
  onChange: (sortBy: MediaSortBy, sortDir: MediaSortDir) => void;
}) {
  const options: Array<{ value: string; label: string }> = [
    { value: "name:asc", label: m.media_sort_name_asc() },
    { value: "name:desc", label: m.media_sort_name_desc() },
    { value: "size:asc", label: m.media_sort_size_asc() },
    { value: "size:desc", label: m.media_sort_size_desc() },
    { value: "time:asc", label: m.media_sort_time_asc() },
    { value: "time:desc", label: m.media_sort_time_desc() },
  ];
  const currentValue = `${sortBy}:${sortDir}`;
  const label = options.find((o) => o.value === currentValue)?.label ?? "";
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={m.media_sort_label()}
        aria-label={m.media_sort_label()}
        onClick={() => setIsOpen((open) => !open)}
        className={triggerClass}
      >
        <ArrowUpDown
          size={isFuwari ? 14 : 12}
          strokeWidth={1.5}
          className={isFuwari ? "fuwari-text-30" : "opacity-60"}
        />
        {label}
      </button>
      {isOpen && (
        <PortalPanel
          triggerRef={triggerRef}
          onClose={() => setIsOpen(false)}
          align="start"
          minWidth={isFuwari ? 192 : 160}
          className={menuPanelClass}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                const [by, dir] = opt.value.split(":") as [
                  MediaSortBy,
                  MediaSortDir,
                ];
                onChange(by, dir);
                setIsOpen(false);
              }}
              className={cn(
                menuOptionClass,
                menuOptionActiveClass(opt.value === currentValue),
              )}
            >
              {opt.label}
            </button>
          ))}
        </PortalPanel>
      )}
    </>
  );
}

function CopyFormatDropdown({
  value,
  onChange,
}: {
  value: CopyLinkFormat;
  onChange: (format: CopyLinkFormat) => void;
}) {
  const label = COPY_FORMATS.find((f) => f.value === value)?.label ?? "URL";
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={m.media_copy_format_label()}
        aria-label={m.media_copy_format_label()}
        onClick={() => setIsOpen((open) => !open)}
        className={triggerClass}
      >
        <Link
          size={isFuwari ? 14 : 12}
          strokeWidth={1.5}
          className={isFuwari ? "fuwari-text-30" : "opacity-60"}
        />
        {label}
      </button>
      {isOpen && (
        <PortalPanel
          triggerRef={triggerRef}
          onClose={() => setIsOpen(false)}
          align="start"
          minWidth={isFuwari ? 192 : 160}
          className={menuPanelClass}
        >
          {COPY_FORMATS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={cn(
                menuOptionClass,
                menuOptionActiveClass(opt.value === value),
              )}
            >
              {opt.label}
            </button>
          ))}
        </PortalPanel>
      )}
    </>
  );
}

export function MediaToolbar({
  searchQuery,
  onSearchChange,
  unusedOnly,
  onUnusedOnlyChange,
  view,
  onViewChange,
  selectedCount,
  totalCount,
  searching,
  onSelectAll,
  onDelete,
  onNewFolder,
  onMove,
  canMoveFiles,
  selectedKeys,
  mediaItems,
  canDelete,
  sortBy,
  sortDir,
  onSortChange,
  copyFormat,
  onCopyFormatChange,
}: MediaToolbarProps) {
  const handleCopyUrls = async () => {
    const links = mediaItems
      .filter((item) => selectedKeys.has(item.key))
      .map((item) => {
        const absoluteUrl = item.url.startsWith("http")
          ? item.url
          : `${window.location.origin}${item.url}`;
        return formatCopyLink(copyFormat, absoluteUrl, item.fileName);
      });

    if (links.length === 0) return;

    try {
      await navigator.clipboard.writeText(links.join("\n"));
      toast.success(m.media_batch_copy_urls_success(), {
        description: m.media_batch_copy_urls_success_desc({
          count: links.length,
        }),
      });
    } catch {
      toast.error(m.media_batch_copy_urls_fail());
    }
  };

  if (isFuwari) {
    return (
      <div className="fuwari-card-base p-3 sm:p-4 flex flex-col gap-4">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full flex-1">
          <div className="relative w-full sm:w-80">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 fuwari-text-30 pointer-events-none"
              size={16}
              strokeWidth={1.5}
            />
            <Input
              type="text"
              placeholder={m.media_search_placeholder()}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSearchChange("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              >
                <X size={14} />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <SortDropdown
              sortBy={sortBy}
              sortDir={sortDir}
              onChange={onSortChange}
            />
            <CopyFormatDropdown
              value={copyFormat}
              onChange={onCopyFormatChange}
            />

            <Button
              variant={unusedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => onUnusedOnlyChange(!unusedOnly)}
              className="gap-2"
            >
              <Filter size={14} strokeWidth={1.5} />
              <span className="hidden sm:inline">
                {m.media_filter_unused()}
              </span>
            </Button>

            {/* View toggle */}
            <div className="flex items-center gap-1 rounded-xl bg-(--fuwari-btn-regular-bg) p-1">
              <button
                type="button"
                onClick={() => onViewChange("grid")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
                  view === "grid"
                    ? "bg-(--fuwari-primary)/10 text-(--fuwari-primary)"
                    : "fuwari-text-75 hover:text-(--fuwari-primary)",
                )}
              >
                <LayoutGrid size={14} strokeWidth={1.5} />
                <span className="hidden sm:inline">{m.media_view_grid()}</span>
              </button>
              <button
                type="button"
                onClick={() => onViewChange("table")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
                  view === "table"
                    ? "bg-(--fuwari-primary)/10 text-(--fuwari-primary)"
                    : "fuwari-text-75 hover:text-(--fuwari-primary)",
                )}
              >
                <List size={14} strokeWidth={1.5} />
                <span className="hidden sm:inline">{m.media_view_list()}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Selection & Actions Bar */}
        {(selectedCount > 0 || searching || onNewFolder) && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-t border-(--fuwari-input-border) pt-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={onSelectAll}
                className="gap-2 h-8"
              >
                {selectedCount === totalCount && totalCount > 0 ? (
                  <CheckSquare size={14} />
                ) : (
                  <Square size={14} />
                )}
                {selectedCount > 0
                  ? m.media_toolbar_selected({ count: selectedCount })
                  : m.media_toolbar_select_all()}
              </Button>

              {selectedCount > 0 && (
                <>
                  <div className="h-4 w-px bg-(--fuwari-input-border)" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyUrls}
                    className="gap-2 h-8"
                  >
                    <Copy size={14} />
                    <span className="hidden sm:inline">
                      {m.media_toolbar_copy_urls({ count: selectedCount })}
                    </span>
                    <span className="sm:hidden">Copy</span>
                  </Button>

                  {canMoveFiles && onMove && (
                    <>
                      <div className="h-4 w-px bg-(--fuwari-input-border)" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onMove}
                        className="gap-2 h-8"
                      >
                        <FolderInput size={14} />
                        <span className="hidden sm:inline">
                          {m.media_toolbar_move({ count: selectedCount })}
                        </span>
                        <span className="sm:hidden">Move</span>
                      </Button>
                    </>
                  )}

                  {canDelete && (
                    <>
                      <div className="h-4 w-px bg-(--fuwari-input-border)" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDelete}
                        className="gap-2 h-8 text-red-500 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                        <span className="hidden sm:inline">
                          {m.media_toolbar_delete({ count: selectedCount })}
                        </span>
                        <span className="sm:hidden">Delete</span>
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>

            {onNewFolder && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onNewFolder}
                className="gap-2 h-8"
              >
                <FolderPlus size={14} />
                {m.media_toolbar_new_folder()}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 mb-8 items-stretch w-full border-b border-border/30 pb-8">
      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4 w-full lg:w-auto flex-1">
        <div className="relative group w-full sm:w-80">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-foreground transition-colors"
            size={14}
            strokeWidth={1.5}
          />
          <Input
            type="text"
            placeholder={m.media_search_placeholder()}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-9 h-10 bg-transparent border-border/30 hover:border-foreground/50 focus:border-foreground transition-all rounded-none font-sans text-sm shadow-none focus-visible:ring-0"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSearchChange("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground rounded-none"
            >
              <X size={14} />
            </Button>
          )}
        </div>

        <div className="h-4 w-px bg-border/30 mx-2 hidden lg:block" />

        <SortDropdown
          sortBy={sortBy}
          sortDir={sortDir}
          onChange={onSortChange}
        />

        <CopyFormatDropdown
          value={copyFormat}
          onChange={onCopyFormatChange}
        />

        <Button
          variant={unusedOnly ? "default" : "outline"}
          size="sm"
          onClick={() => onUnusedOnlyChange(!unusedOnly)}
          className={cn(
            "h-10 px-3 md:px-4 gap-2 rounded-none border-border/30 hover:border-foreground transition-all shrink-0",
            unusedOnly
              ? "bg-foreground text-background border-foreground"
              : "bg-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Filter size={14} strokeWidth={1.5} />
          <span className="hidden sm:inline text-[11px] uppercase tracking-widest font-mono">
            {m.media_filter_unused()}
          </span>
        </Button>

        {/* View toggle */}
        <div className="flex items-center border border-border/30 rounded-none shrink-0">
          <button
            type="button"
            onClick={() => onViewChange("grid")}
            className={cn(
              "flex items-center gap-2 h-10 px-3 md:px-4 transition-all rounded-none",
              view === "grid"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid size={14} strokeWidth={1.5} />
            <span className="hidden sm:inline text-[11px] uppercase tracking-widest font-mono">
              {m.media_view_grid()}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onViewChange("table")}
            className={cn(
              "flex items-center gap-2 h-10 px-3 md:px-4 border-l border-border/30 transition-all rounded-none",
              view === "table"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List size={14} strokeWidth={1.5} />
            <span className="hidden sm:inline text-[11px] uppercase tracking-widest font-mono">
              {m.media_view_list()}
            </span>
          </button>
        </div>
      </div>

      {/* Selection & Actions Bar */}
      {(selectedCount > 0 || searching || onNewFolder) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-t border-border/30 pt-4">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={onSelectAll}
              className="gap-2 h-8 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground rounded-none"
            >
              {selectedCount === totalCount && totalCount > 0 ? (
                <CheckSquare size={14} />
              ) : (
                <Square size={14} />
              )}
              {selectedCount > 0
                ? m.media_toolbar_selected({ count: selectedCount })
                : m.media_toolbar_select_all()}
            </Button>

            {selectedCount > 0 && (
              <>
                <div className="hidden sm:block h-4 w-px bg-border/30" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyUrls}
                  className="gap-2 h-8 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground rounded-none"
                >
                  <Copy size={14} />
                  <span className="hidden sm:inline">
                    {m.media_toolbar_copy_urls({ count: selectedCount })}
                  </span>
                  <span className="sm:hidden">Copy</span>
                </Button>

                {canMoveFiles && onMove && (
                  <>
                    <div className="hidden sm:block h-4 w-px bg-border/30" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onMove}
                      className="gap-2 h-8 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground rounded-none"
                    >
                      <FolderInput size={14} />
                      <span className="hidden sm:inline">
                        {m.media_toolbar_move({ count: selectedCount })}
                      </span>
                      <span className="sm:hidden">Move</span>
                    </Button>
                  </>
                )}

                {canDelete && (
                  <>
                    <div className="hidden sm:block h-4 w-px bg-border/30" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onDelete}
                      className="gap-2 h-8 text-xs font-mono uppercase tracking-widest text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-none"
                    >
                      <Trash2 size={14} />
                      <span className="hidden sm:inline">
                        {m.media_toolbar_delete({ count: selectedCount })}
                      </span>
                      <span className="sm:hidden">Delete</span>
                    </Button>
                  </>
                )}
              </>
            )}
          </div>

          {onNewFolder && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewFolder}
              className="gap-2 h-8 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground rounded-none"
            >
              <FolderPlus size={14} />
              {m.media_toolbar_new_folder()}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
