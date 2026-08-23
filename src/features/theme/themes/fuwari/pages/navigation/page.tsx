import { Link } from "@tanstack/react-router";
import { ArrowLeft, Folder, Search } from "lucide-react";
import {
  getHostname,
  useFaviconSource,
} from "@/features/navigation/components/favicon";
import { MaskedName } from "@/features/navigation/components/masked-name";
import { useGridPagination } from "@/features/navigation/hooks/use-grid-pagination";
import { useNavigationPageState } from "@/features/navigation/hooks/use-navigation-page-state";
import type { NavigationPageProps } from "@/features/theme/contract/pages";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { Pagination } from "../../components/pagination";

export function NavigationPage({
  data,
  isAdmin,
  showBookmarks,
}: NavigationPageProps) {
  const grid = useGridPagination();
  const state = useNavigationPageState(data, grid.pageSize);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header Banner */}
      <div
        className="fuwari-card-base p-6 md:p-8 relative overflow-hidden flex flex-col items-center justify-center min-h-56 fuwari-onload-animation bg-linear-to-br from-(--fuwari-primary)/5 to-transparent"
        style={{ animationDelay: "150ms" }}
      >
        <h1 className="text-3xl md:text-4xl font-bold fuwari-text-90 mb-4 z-10 transition-colors">
          {m.navigation_title()}
        </h1>
        <p className="fuwari-text-50 text-center max-w-xl z-10 transition-colors">
          {m.navigation_desc()}
        </p>
      </div>

      {/* Search Area */}
      <div
        className="fuwari-card-base p-6 md:p-8 flex flex-col gap-6 fuwari-onload-animation"
        style={{ animationDelay: "250ms" }}
      >
        {state.engines.length > 0 ? (
          <div className="flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain no-scrollbar md:flex-wrap md:justify-center py-1">
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
          <p className="text-sm fuwari-text-30 text-center transition-colors">
            {m.navigation_no_engines()}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            state.submitSearch();
          }}
          className="flex gap-2.5"
        >
          <input
            type="text"
            value={state.query}
            onChange={(e) => state.setQuery(e.target.value)}
            placeholder={m.navigation_search_placeholder()}
            className="flex-1 min-w-0 h-12 px-4 rounded-xl border border-(--fuwari-input-border) bg-(--fuwari-input-bg) focus:outline-none focus:border-(--fuwari-primary)/50 focus:ring-1 focus:ring-(--fuwari-primary)/20 transition-all fuwari-text-90 text-sm placeholder:text-(--fuwari-text-30)"
          />
          <button
            type="submit"
            className="fuwari-btn-primary shrink-0 h-12 px-7 text-sm font-bold rounded-xl gap-2 active:scale-95 transition-all"
          >
            <Search className="w-4 h-4" />
            {m.navigation_search_btn()}
          </button>
        </form>
      </div>

      {/* Bookmarks（仅管理员可见） */}
      {showBookmarks && (
        <div
          className="fuwari-card-base p-6 md:p-8 flex flex-col gap-5 fuwari-onload-animation flex-1"
          style={{ animationDelay: "350ms" }}
        >
          {/* 面包屑：根目录 ↔ 文件夹 */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              {state.currentFolder ? (
                <>
                  <button
                    type="button"
                    onClick={state.backToRoot}
                    className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold fuwari-btn-regular active:scale-95 transition-all"
                  >
                    <ArrowLeft size={13} />
                    {m.navigation_all()}
                  </button>
                  <h2 className="text-xl font-bold fuwari-text-90 truncate transition-colors">
                    {state.currentFolder.name}
                  </h2>
                </>
              ) : (
                <h2 className="text-xl font-bold fuwari-text-90 transition-colors">
                  {m.navigation_bookmarks()}
                </h2>
              )}
            </div>
            {isAdmin && (
              <Link
                to="/admin/navigation"
                className="fuwari-btn-regular text-xs font-bold px-4 py-2 rounded-xl active:scale-95 transition-all"
              >
                [ {m.navigation_admin_title()} ]
              </Link>
            )}
          </div>
          {!state.currentFolder && (
            <p className="-mt-3 text-xs font-bold fuwari-text-30 transition-colors">
              {m.navigation_level_summary({
                folders: state.folders.length,
                bookmarks: state.bookmarks.filter(
                  (b) => b.folderId === null,
                ).length,
              })}
            </p>
          )}

          {state.pageItems.length > 0 ? (
            <>
              {/* 卡片网格：固定尺寸卡片，列数随屏宽自适应，按同级数量自动分页 */}
              <div
                ref={grid.containerRef}
                className="flex flex-wrap content-start gap-2"
              >
                {state.pageItems.map((item, i) =>
                  item.kind === "folder" ? (
                    <FolderCard
                      key={`folder-${item.folder.id}`}
                      folder={item.folder}
                      onOpen={() => state.enterFolder(item.folder.id)}
                      className="fuwari-onload-animation"
                      style={{ animationDelay: `${400 + i * 40}ms` }}
                    />
                  ) : (
                    <BookmarkCard
                      key={item.bookmark.id}
                      bookmark={item.bookmark}
                      className="fuwari-onload-animation"
                      style={{ animationDelay: `${400 + i * 40}ms` }}
                    />
                  ),
                )}
              </div>

              {state.total > state.pageSize && (
                <div className="border-t border-(--fuwari-input-border) pt-5">
                  <Pagination
                    page={state.page}
                    total={state.total}
                    pageSize={state.pageSize}
                    hasPrevPage={state.hasPrevPage}
                    hasNextPage={state.hasNextPage}
                    onPageChange={state.onPageChange}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 fuwari-text-30 transition-colors">
              <p className="text-lg">{m.navigation_no_bookmarks()}</p>
              <p className="mt-2 text-sm">{m.navigation_no_bookmarks_desc()}</p>
            </div>
          )}
        </div>
      )}
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
      className={cn(
        "shrink-0 inline-flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-bold transition-all active:scale-95",
        selected ? "fuwari-btn-primary" : "fuwari-btn-regular hover:shadow-sm",
      )}
    >
      <span className="w-4 h-4 flex items-center justify-center overflow-hidden rounded-md shrink-0">
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

interface CardStyleProps {
  className?: string;
  style?: React.CSSProperties;
}

interface FolderCardProps extends CardStyleProps {
  folder: { id: number; name: string };
  onOpen: () => void;
}

/** 文件夹卡片：左侧文件夹图标 + 右侧分类名（超出虚化） */
function FolderCard({ folder, onOpen, className, style }: FolderCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={folder.name}
      className={cn(
        "fuwari-card-base flex h-11 w-36 items-center gap-2 px-2.5 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group active:scale-[0.98]",
        className,
      )}
      style={style}
    >
      <span className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center shrink-0 border border-black/5 dark:border-white/5 text-(--fuwari-text-50) group-hover:text-(--fuwari-primary) transition-colors">
        <Folder size={14} strokeWidth={1.75} />
      </span>
      <MaskedName
        title={folder.name}
        className="text-[13px] font-bold fuwari-text-75 group-hover:text-(--fuwari-primary) transition-colors"
      >
        {folder.name}
      </MaskedName>
    </button>
  );
}

interface BookmarkCardProps extends CardStyleProps {
  bookmark: {
    id: number;
    name: string;
    url: string;
  };
}

/** 书签卡片：左侧网站标签页图标 + 右侧书签名（最多约 6 个中文字符，超出虚化） */
function BookmarkCard({ bookmark, className, style }: BookmarkCardProps) {
  const domain = getHostname(bookmark.url);
  const favicon = useFaviconSource(domain);

  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      title={bookmark.name}
      className={cn(
        "fuwari-card-base flex h-11 w-36 items-center gap-2 px-2.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group active:scale-[0.98]",
        className,
      )}
      style={style}
    >
      <span className="w-7 h-7 rounded-lg overflow-hidden bg-black/5 dark:bg-white/5 flex items-center justify-center shrink-0 border border-black/5 dark:border-white/5">
        {favicon.hasIcon ? (
          <img
            src={favicon.src}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={favicon.onError}
          />
        ) : (
          <span className="text-[10px] font-bold fuwari-text-50 transition-colors">
            {bookmark.name.slice(0, 1)}
          </span>
        )}
      </span>
      <MaskedName
        title={bookmark.name}
        className="text-[13px] font-bold fuwari-text-75 group-hover:text-(--fuwari-primary) transition-colors"
      >
        {bookmark.name}
      </MaskedName>
    </a>
  );
}
