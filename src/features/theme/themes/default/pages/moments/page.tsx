import { Clock } from "lucide-react";
import type { MomentsPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";

export function MomentsPage({
  moments,
  total,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: MomentsPageProps) {
  return (
    <div className="w-full max-w-3xl mx-auto pb-20 px-6 md:px-0">
      {/* Header */}
      <header className="py-12 md:py-20 space-y-6">
        <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight text-foreground">
          {m.moments_title()}
        </h1>
        <p className="max-w-xl text-base md:text-lg font-light text-muted-foreground leading-relaxed">
          {m.moments_desc()}
        </p>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
          {m.moments_total({ count: total })}
        </p>
      </header>

      {/* Moments List */}
      <div className="min-h-50">
        {moments.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-serif text-lg text-muted-foreground/50">
              {m.moments_no_moments()}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {moments.map((moment) => (
              <div
                key={moment.id}
                className="py-6 border-b border-border/20 last:border-b-0"
              >
                <p className="text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {moment.content}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground font-mono">
                  <Clock size={12} />
                  <span>{formatMomentDate(moment.createdAt)}</span>
                  {moment.author?.name ? (
                    <span>· {moment.author.name}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {hasMore && (
          <div className="mt-12 text-center">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="text-sm font-mono text-muted-foreground hover:text-foreground transition-colors border border-border/50 hover:border-border px-8 py-2 disabled:opacity-40"
            >
              {isLoadingMore ? m.moments_loading_more() : m.moments_load_more()}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatMomentDate(date: Date | string) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
