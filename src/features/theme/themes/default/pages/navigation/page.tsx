import { Link } from "@tanstack/react-router";
import type { NavigationPageProps } from "@/features/theme/contract/pages";
import {
  getHostname,
  useFaviconSource,
} from "@/features/navigation/components/favicon";
import { useNavigationPageState } from "@/features/navigation/hooks/use-navigation-page-state";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { Pagination } from "../../components/pagination";

export function NavigationPage({ data, isAdmin }: NavigationPageProps) {
  const state = useNavigationPageState(data);

  return (
    <div className="w-full max-w-4xl mx-auto pb-20 px-6 md:px-0">
      {/* Header */}
      <header className="py-12 md:py-16 space-y-6 text-center">
        <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight text-foreground">
          {m.navigation_title()}
        </h1>
        <p className="max-w-xl mx-auto text-base md:text-lg font-light text-muted-foreground leading-relaxed">
          {m.navigation_desc()}
        </p>
      </header>

      {/* Search Area */}
      <div className="border border-border/40 bg-background/50 rounded-lg p-6 md:p-8 space-y-6">
        {/* Engine buttons (horizontal, responsive) */}
        {state.engines.length > 0 ? (
          <div className="flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain no-scrollbar md:flex-wrap md:justify-center">
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
          <p className="text-sm text-muted-foreground/50 text-center">
            {m.navigation_no_engines()}
          </p>
        )}

        {/* Search form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            state.submitSearch();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={state.query}
            onChange={(e) => state.setQuery(e.target.value)}
            placeholder={m.navigation_search_placeholder()}
            className="flex-1 min-w-0 h-11 bg-transparent border border-border/50 px-4 text-sm text-foreground placeholder:text-muted-foreground/30 focus:border-foreground/60 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            className="h-11 px-6 bg-foreground text-background text-sm font-mono hover:bg-foreground/90 transition-colors whitespace-nowrap shrink-0"
          >
            {m.navigation_search_btn()}
          </button>
        </form>
      </div>

      {/* Bookmarks */}
      <section className="mt-14 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-serif text-xl font-medium text-foreground">
            {m.navigation_bookmarks()}
          </h2>
          {isAdmin && (
            <Link
              to="/admin/navigation"
              className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              [ {m.navigation_admin_title()} ]
            </Link>
          )}
        </div>

        {/* Folder Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain no-scrollbar pb-1">
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

        {/* Bookmark Cards */}
        {state.pageItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {state.pageItems.map((bookmark) => (
              <BookmarkCard key={bookmark.id} bookmark={bookmark} />
            ))}
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
      className={cn(
        "shrink-0 inline-flex items-center gap-2 px-3 h-9 rounded-md border text-xs font-mono transition-all",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border/40 bg-background/50 text-muted-foreground hover:border-border/80 hover:text-foreground",
      )}
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
        "shrink-0 px-4 h-8 rounded-full border text-xs font-mono transition-all whitespace-nowrap",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border/40 bg-background/50 text-muted-foreground hover:border-border/80 hover:text-foreground",
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
}

function BookmarkCard({ bookmark }: BookmarkCardProps) {
  const domain = getHostname(bookmark.url);
  const favicon = useFaviconSource(domain);

  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col items-center justify-center gap-2.5 p-4 min-h-24 rounded-lg border border-border/40 bg-background/50 hover:border-border/80 hover:bg-muted/30 transition-all text-center"
    >
      <div className="w-9 h-9 rounded-md bg-muted/30 border border-border/40 flex items-center justify-center overflow-hidden shrink-0">
        {favicon.hasIcon ? (
          <img
            src={favicon.src}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={favicon.onError}
          />
        ) : (
          <span className="text-xs font-serif font-medium text-muted-foreground/60">
            {bookmark.name.slice(0, 1)}
          </span>
        )}
      </div>
      <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground truncate max-w-full px-1">
        {bookmark.name}
      </span>
    </a>
  );
}
