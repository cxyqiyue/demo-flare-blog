import {
  CheckSquare,
  Copy,
  Filter,
  FolderPlus,
  LayoutGrid,
  List,
  Search,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MediaFileItem } from "../hooks/use-media-library";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

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
  selectedKeys: Set<string>;
  mediaItems: MediaFileItem[];
  canDelete: boolean;
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
  selectedKeys,
  mediaItems,
  canDelete,
}: MediaToolbarProps) {
  const handleCopyUrls = async () => {
    const urls = mediaItems
      .filter((item) => selectedKeys.has(item.key))
      .map((item) => {
        const absoluteUrl = item.url.startsWith("http")
          ? item.url
          : `${window.location.origin}${item.url}`;
        return absoluteUrl;
      });

    if (urls.length === 0) return;

    try {
      await navigator.clipboard.writeText(urls.join("\n"));
      toast.success(m.media_batch_copy_urls_success(), {
        description: m.media_batch_copy_urls_success_desc({ count: urls.length }),
      });
    } catch {
      toast.error(m.media_batch_copy_urls_fail());
    }
  };

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
      {(selectedCount > 0 || searching) && (
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
                  <span className="hidden sm:inline">{m.media_toolbar_copy_urls({ count: selectedCount })}</span>
                  <span className="sm:hidden">Copy</span>
                </Button>

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
                      <span className="hidden sm:inline">{m.media_toolbar_delete({ count: selectedCount })}</span>
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
