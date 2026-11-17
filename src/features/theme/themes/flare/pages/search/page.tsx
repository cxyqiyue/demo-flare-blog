import { ArrowLeft, Loader2, Search } from "lucide-react";
import { useEffect, useRef } from "react";
import type { SearchPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";

export function SearchPage({
  query,
  results,
  isSearching,
  onQueryChange,
  onSelectPost,
  onBack,
}: SearchPageProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
              {results.length}
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
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder={m.search_input_label()}
                className="h-12 w-full rounded-full border border-border/60 bg-background/70 pl-11 pr-4 text-base text-foreground placeholder:text-muted-foreground/40 focus:border-border focus:outline-none focus:ring-2 focus:ring-ring/30 md:text-lg"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border/50" aria-busy={isSearching}>
          {isSearching ? (
            <div
              role="status"
              className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
            >
              <Loader2 size={16} className="animate-spin" />
              {m.posts_loading()}
            </div>
          ) : null}
          {query.trim() !== "" && !isSearching && results.length === 0 ? (
            <div className="px-5 py-16 text-center md:px-8">
              <p className="text-lg text-muted-foreground/70">
                {m.search_no_results()} "{query}"
              </p>
            </div>
          ) : null}

          {results.length > 0 ? (
            <ul className="divide-y divide-border/50">
              {results.map((result) => (
                <li key={result.post.id}>
                  <button
                    type="button"
                    onClick={() => onSelectPost(result.post.slug)}
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

                    {result.post.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {result.post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="flare-chip h-6 px-2 text-[11px]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </div>
  );
}
