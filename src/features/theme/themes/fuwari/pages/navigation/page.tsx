import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import type { NavigationPageProps } from "@/features/theme/contract/pages";
import {
  getHostname,
  useFaviconSource,
} from "@/features/navigation/components/favicon";
import { useNavigationPageState } from "@/features/navigation/hooks/use-navigation-page-state";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { Pagination } from "../../components/pagination";

export function NavigationPage({ data, isAdmin, showBookmarks }: NavigationPageProps) {
  const state = useNavigationPageState(data);

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
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-xl font-bold fuwari-text-90 transition-colors">
            {m.navigation_bookmarks()}
          </h2>
          {isAdmin && (
            <Link
              to="/admin/navigation"
              className="fuwari-btn-regular text-xs font-bold px-4 py-2 rounded-xl active:scale-95 transition-all"
            >
              [ {m.navigation_admin_title()} ]
            </Link>
          )}
        </div>

        {/* Folder Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain no-scrollbar py-1">
          <FolderTab
            active={state.activeFolderId === null}
            onClick={() => state.selectFolder(null)}
            label={`${m.navigation_all()} (${state.totalBookmarks})`}
          />
          {state.folders.map((folder) => (
            <FolderTab
              key={folder.id}
              active={state.activeFolderId === folder.id}
              onClick={() => state.selectFolder(folder.id)}
              label={`${folder.name} (${folder.bookmarkCount})`}
            />
          ))}
        </div>

        {state.pageItems.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {state.pageItems.map((bookmark, i) => (
                <BookmarkCard
                  key={bookmark.id}
                  bookmark={bookmark}
                  className="fuwari-onload-animation"
                  style={{ animationDelay: `${400 + i * 40}ms` }}
                />
              ))}
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
        selected
          ? "fuwari-btn-primary"
          : "fuwari-btn-regular hover:shadow-sm",
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

interface FolderTabProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

function FolderTab({ active, onClick, label }: FolderTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 px-4 h-8 rounded-full text-xs font-bold transition-all whitespace-nowrap active:scale-95",
        active ? "fuwari-btn-primary" : "fuwari-btn-regular",
      )}
    >
      {label}
    </button>
  );
}

interface BookmarkCardProps {
  bookmark: {
    id: number;
    name: string;
    url: string;
  };
  className?: string;
  style?: React.CSSProperties;
}

function BookmarkCard({ bookmark, className, style }: BookmarkCardProps) {
  const domain = getHostname(bookmark.url);
  const favicon = useFaviconSource(domain);

  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "fuwari-card-base flex flex-col items-center justify-center gap-2.5 p-4 min-h-24 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group active:scale-[0.98]",
        className,
      )}
      style={style}
    >
      <div className="w-9 h-9 rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 flex items-center justify-center border border-black/5 dark:border-white/5 transition-transform duration-300 group-hover:scale-105 shrink-0">
        {favicon.hasIcon ? (
          <img
            src={favicon.src}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={favicon.onError}
          />
        ) : (
          <span className="text-xs font-bold fuwari-text-50 transition-colors">
            {bookmark.name.slice(0, 1)}
          </span>
        )}
      </div>
      <span className="text-xs font-bold fuwari-text-75 group-hover:text-(--fuwari-primary) truncate max-w-full px-1 transition-colors">
        {bookmark.name}
      </span>
    </a>
  );
}
