import { ArrowLeft } from "lucide-react";
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
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  return (
    <div className="w-full mx-auto pb-10 space-y-4 md:space-y-6">
      <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 md:p-7 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>{m.search_back()}</span>
          </button>
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-medium text-muted-foreground">
            {m.search_input_label()}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={m.search_input_label()}
            className="w-full rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-lg md:text-2xl text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 md:p-6 shadow-sm space-y-2">
        {query.trim() !== "" && !isSearching && results.length === 0 && (
          <div className="py-12 opacity-50">
            <p className="font-serif text-lg text-muted-foreground">
              {m.search_no_results()} "{query}"
            </p>
          </div>
        )}

        {results.map((result) => {
          return (
            <div
              key={result.post.id}
              onClick={() => onSelectPost(result.post.slug)}
              className="group relative cursor-pointer p-4 -mx-4 transition-all duration-300 rounded-lg hover:bg-muted/10"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <h4
                    className="text-lg md:text-xl text-muted-foreground font-serif tracking-tight transition-colors duration-300 group-hover:text-foreground"
                    style={{
                      viewTransitionName: `post-title-${result.post.slug}`,
                    }}
                    dangerouslySetInnerHTML={{
                      __html: result.matches.title || result.post.title,
                    }}
                  />
                </div>

                <p
                  className="text-sm font-sans text-muted-foreground line-clamp-2 opacity-60 group-hover:opacity-100 transition-opacity duration-300"
                  dangerouslySetInnerHTML={{
                    __html: result.matches.summary || result.post.summary || "",
                  }}
                />

                {result.post.tags.length > 0 && (
                  <div className="flex gap-2 pt-2">
                    {result.post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] uppercase tracking-wider font-mono text-muted-foreground/60 border border-border/30 px-1.5 py-0.5 rounded-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
