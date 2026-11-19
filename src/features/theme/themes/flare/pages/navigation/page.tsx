import { Link } from "@tanstack/react-router";
import { ArrowLeft, Folder } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  getHostname,
  useFaviconSource,
} from "@/features/navigation/components/favicon";
import { MaskedName } from "@/features/navigation/components/masked-name";
import { useGridPagination } from "@/features/navigation/hooks/use-grid-pagination";
import { useNavigationPageState } from "@/features/navigation/hooks/use-navigation-page-state";
import type { NavigationPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";
import { Pagination } from "../../components/pagination";

export function NavigationPage({
  data,
  isAdmin,
  showBookmarks,
}: NavigationPageProps) {
  const grid = useGridPagination();
  const state = useNavigationPageState(data, grid.pageSize);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 桌面端（具备精确指针）首次进入时自动聚焦搜索框；移动端不抢占，避免弹软键盘
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) {
      searchInputRef.current?.focus();
    }
  }, []);

  return (
    <div className="flare-enter flex w-full flex-col gap-4">
      <section className="flare-surface overflow-hidden">
        <div className="space-y-5 p-5 md:p-8">
          <header className="space-y-2 text-center md:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-[2.5rem]">
              {m.navigation_title()}
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-[15px]">
              {m.navigation_desc()}
            </p>
          </header>

          <div className="space-y-4">
            {state.engines.length > 0 ? (
              <div className="no-scrollbar flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain md:flex-wrap">
                {state.engines.map((engine) => (
                  <EngineButton
                    key={engine.id}
                    engine={engine}
                    selected={state.selectedEngine?.id === engine.id}
                    onSelect={() => state.selectEngine(engine.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/60">
                {m.navigation_no_engines()}
              </p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                state.submitSearch();
              }}
              role="search"
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2 sm:gap-3"
            >
              <input
                ref={searchInputRef}
                type="text"
                enterKeyHint="search"
                value={state.query}
                onChange={(e) => state.setQuery(e.target.value)}
                placeholder={m.navigation_search_placeholder()}
                aria-label={m.navigation_search_placeholder()}
                className="block h-12 min-h-12 w-full min-w-0 rounded-full border border-border/60 bg-background/70 px-4 text-base md:text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              <button
                type="submit"
                className="inline-flex h-12 min-h-12 items-center justify-center whitespace-nowrap rounded-full bg-foreground px-4 sm:px-6 text-sm font-medium text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {m.navigation_search_btn()}
              </button>
            </form>
          </div>
        </div>

        {/* Bookmarks（仅管理员可见） */}
        {showBookmarks && (
          <div className="space-y-6 border-t border-border/50 p-5 md:p-8">
            {/* 面包屑：根目录 ↔ 文件夹 */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {state.currentFolder ? (
                  <>
                    <button
                      type="button"
                      onClick={state.backToRoot}
                      className="flare-chip h-8 shrink-0 px-3 text-xs"
                    >
                      <ArrowLeft size={13} />
                      {m.navigation_all()}
                    </button>
                    <h2 className="truncate text-xl font-semibold text-foreground">
                      {state.currentFolder.name}
                    </h2>
                  </>
                ) : (
                  <h2 className="text-xl font-semibold text-foreground">
                    {m.navigation_bookmarks()}
                  </h2>
                )}
              </div>
              {isAdmin && (
                <Link
                  to="/admin/navigation"
                  className="text-xs font-mono text-muted-foreground transition-colors hover:text-foreground"
                >
                  [ {m.navigation_admin_title()} ]
                </Link>
              )}
            </div>
            {!state.currentFolder && (
              <p className="-mt-3 text-xs font-mono text-muted-foreground/60">
                {m.navigation_level_summary({
                  folders: state.folders.length,
                  bookmarks: state.bookmarks.filter((b) => b.folderId === null)
                    .length,
                })}
              </p>
            )}

            {/* 卡片网格：固定尺寸卡片，列数随屏宽自适应，按同级数量自动分页 */}
            {state.pageItems.length > 0 ? (
              <div
                ref={grid.containerRef}
                className="flex flex-wrap content-start gap-2"
              >
                {state.pageItems.map((item) =>
                  item.kind === "folder" ? (
                    <FolderCard
                      key={`folder-${item.folder.id}`}
                      folder={item.folder}
                      onOpen={() => state.enterFolder(item.folder.id)}
                    />
                  ) : (
                    <BookmarkCard
                      key={item.bookmark.id}
                      bookmark={item.bookmark}
                    />
                  ),
                )}
              </div>
            ) : (
              <div className="py-16 text-center">
                <p className="font-serif text-lg text-muted-foreground/50">
                  {m.navigation_no_bookmarks()}
                </p>
                <p className="mt-2 text-sm text-muted-foreground/30 font-mono">
                  {m.navigation_no_bookmarks_desc()}
                </p>
              </div>
            )}

            {state.total > state.pageSize && (
              <Pagination
                page={state.page}
                total={state.total}
                pageSize={state.pageSize}
                hasPrevPage={state.hasPrevPage}
                hasNextPage={state.hasNextPage}
                onPageChange={state.onPageChange}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ============ Sub-components ============

interface EngineButtonProps {
  engine: {
    id: number;
    name: string;
    domain: string;
    iconUrl: string | null;
  };
  selected: boolean;
  onSelect: () => void;
}

function EngineButton({ engine, selected, onSelect }: EngineButtonProps) {
  const favicon = useFaviconSource(engine.domain, engine.iconUrl);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="flare-chip h-9 shrink-0 font-mono"
      data-active={selected}
    >
      <span className="w-4 h-4 flex items-center justify-center overflow-hidden rounded-sm shrink-0">
        {favicon.hasIcon ? (
          <img
            src={favicon.src}
            alt=""
            className="w-full h-full object-cover"
            onError={favicon.onError}
          />
        ) : (
          <span className="text-[8px] font-medium leading-none">
            {engine.name.slice(0, 1)}
          </span>
        )}
      </span>
      <span className="whitespace-nowrap">{engine.name}</span>
    </button>
  );
}

interface FolderCardProps {
  folder: { id: number; name: string };
  onOpen: () => void;
}

/** 文件夹卡片：左侧文件夹图标 + 右侧分类名（超出虚化） */
function FolderCard({ folder, onOpen }: FolderCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={folder.name}
      className="group flex h-11 w-36 items-center gap-2 rounded-lg border border-border/40 bg-background/50 px-2.5 text-left transition-all hover:border-border/80 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20"
    >
      <span className="w-7 h-7 rounded-md bg-muted/40 border border-border/40 flex items-center justify-center shrink-0 text-muted-foreground group-hover:text-foreground group-hover:bg-muted/60 transition-colors">
        <Folder size={14} strokeWidth={1.75} />
      </span>
      <MaskedName
        title={folder.name}
        className="text-[13px] font-medium text-foreground/80 group-hover:text-foreground transition-colors"
      >
        {folder.name}
      </MaskedName>
    </button>
  );
}

interface BookmarkCardProps {
  bookmark: {
    id: number;
    name: string;
    url: string;
  };
}

/** 书签卡片：左侧网站标签页图标 + 右侧书签名（最多约 6 个中文字符，超出虚化） */
function BookmarkCard({ bookmark }: BookmarkCardProps) {
  const domain = getHostname(bookmark.url);
  const favicon = useFaviconSource(domain);

  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      title={bookmark.name}
      className="group flex h-11 w-36 items-center gap-2 rounded-lg border border-border/40 bg-background/50 px-2.5 transition-all hover:border-border/80 hover:bg-muted/30"
    >
      <span className="w-7 h-7 rounded-md overflow-hidden bg-muted/30 border border-border/40 flex items-center justify-center shrink-0">
        {favicon.hasIcon ? (
          <img
            src={favicon.src}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={favicon.onError}
          />
        ) : (
          <span className="text-[10px] font-serif font-medium text-muted-foreground/60">
            {bookmark.name.slice(0, 1)}
          </span>
        )}
      </span>
      <MaskedName
        title={bookmark.name}
        className="text-[13px] font-medium text-foreground/80 group-hover:text-foreground transition-colors"
      >
        {bookmark.name}
      </MaskedName>
    </a>
  );
}
