import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SearchPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";
import { CollapsibleChips } from "../../components/collapsible-chips";

export function SearchPage({
  query,
  results,
  isSearching,
  onQueryChange,
  onBack,
}: SearchPageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isComposing = useRef(false);
  const [inputValue, setInputValue] = useState(query);
  const hasQuery = query.trim() !== "";
  const visibleResults = hasQuery ? results : [];

  useEffect(() => {
    if (!isComposing.current) setInputValue(query);
  }, [query]);

  useEffect(() => {
    if (!window.matchMedia("(min-width: 768px) and (pointer: fine)").matches) {
      return;
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flare-enter flex w-full flex-col gap-4">
      <section className="flare-surface overflow-hidden">
        <div className="space-y-5 p-5 md:p-8">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onBack} className="flare-chip">
              <ArrowLeft size={14} />
              <span>{m.search_back()}</span>
            </button>
            <span className="rounded-full bg-muted/60 px-2.5 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
              {visibleResults.length}
            </span>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="flare-search"
              className="block text-xs font-medium text-muted-foreground"
            >
              {m.search_input_label()}
            </label>
            <div className="relative">
              <Search
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50"
              />
              <input
                ref={inputRef}
                id="flare-search"
                type="search"
                value={inputValue}
                onCompositionStart={() => {
                  isComposing.current = true;
                }}
                onCompositionEnd={(e) => {
                  isComposing.current = false;
                  setInputValue(e.currentTarget.value);
                  onQueryChange(e.currentTarget.value);
                }}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setInputValue(value);
                  if (!isComposing.current) onQueryChange(value);
                }}
                placeholder={m.search_input_label()}
                aria-controls="flare-search-results"
                className="h-12 w-full rounded-full border border-border/60 bg-background/70 pl-11 pr-12 text-base text-foreground placeholder:text-muted-foreground/40 focus:border-border focus:outline-none focus:ring-2 focus:ring-ring/30 md:text-lg [&::-webkit-search-cancel-button]:appearance-none"
              />
              {inputValue !== "" ? (
                <button
                  type="button"
                  aria-label={m.tag_manager_clear_search()}
                  onClick={() => {
                    isComposing.current = false;
                    setInputValue("");
                    onQueryChange("");
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <p
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {hasQuery
            ? isSearching
              ? m.posts_loading()
              : visibleResults.length === 0
                ? `${m.search_no_results()} "${query}"`
                : `${m.search_title()}: ${visibleResults.length}`
            : ""}
        </p>
        <div
          id="flare-search-results"
          className="border-t border-border/50"
          aria-busy={hasQuery && isSearching}
        >
          {hasQuery && isSearching ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              {m.posts_loading()}
            </div>
          ) : null}
          {hasQuery && !isSearching && visibleResults.length === 0 ? (
            <div className="px-5 py-16 text-center md:px-8">
              <p className="text-lg text-muted-foreground/70">
                {m.search_no_results()} "{query}"
              </p>
            </div>
          ) : null}

          {visibleResults.length > 0 ? (
            <ul className="divide-y divide-border/50">
              {visibleResults.map((result) => (
                <li key={result.post.id} className="min-w-0">
                  <Link
                    to="/post/$slug"
                    params={{ slug: result.post.slug }}
                    className="group flex w-full flex-col gap-2 px-5 py-4 text-left transition-colors hover:bg-muted/30 md:px-8 md:py-5"
                  >
                    {result.matches.title ? (
                      <h2
                        className="text-lg font-semibold text-foreground group-hover:text-primary md:text-xl"
                        dangerouslySetInnerHTML={{
                          __html: result.matches.title,
                        }}
                      />
                    ) : (
                      <h2 className="text-lg font-semibold text-foreground group-hover:text-primary md:text-xl">
                        {result.post.title}
                      </h2>
                    )}

                    {result.matches.contentSnippet || result.matches.summary ? (
                      <p
                        className="line-clamp-2 text-sm leading-6 text-muted-foreground"
                        dangerouslySetInnerHTML={{
                          __html:
                            result.matches.contentSnippet ||
                            result.matches.summary ||
                            "",
                        }}
                      />
                    ) : (
                      <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {result.post.summary}
                      </p>
                    )}
                  </Link>
                  {result.post.tags.length > 0 ? (
                    <div className="px-5 pb-3 md:px-8">
                      <CollapsibleChips>
                        {result.post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="flare-chip h-6 px-2 text-[11px]"
                          >
                            {tag}
                          </span>
                        ))}
                      </CollapsibleChips>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </div>
  );
}
