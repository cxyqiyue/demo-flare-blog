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
    <div className="flex flex-col gap-4 w-full">
      {/* Header Banner */}
      <div
        className="fuwari-card-base p-6 md:p-8 relative overflow-hidden flex flex-col items-center justify-center min-h-56 fuwari-onload-animation bg-linear-to-br from-(--fuwari-primary)/5 to-transparent"
        style={{ animationDelay: "150ms" }}
      >
        <h1 className="text-3xl md:text-4xl font-bold fuwari-text-90 mb-4 z-10 transition-colors">
          {m.moments_title()}
        </h1>
        <p className="fuwari-text-50 text-center max-w-xl z-10 transition-colors">
          {m.moments_desc()}
        </p>
        <span className="mt-6 z-10 fuwari-text-40 text-sm font-mono transition-colors">
          {m.moments_total({ count: total })}
        </span>
      </div>

      {/* Moments List */}
      <div
        className="fuwari-card-base p-6 md:p-8 fuwari-onload-animation flex-1"
        style={{ animationDelay: "300ms" }}
      >
        {moments.length > 0 ? (
          <div className="space-y-4 md:space-y-6">
            {moments.map((moment, i) => (
              <div
                key={moment.id}
                className="fuwari-onload-animation border-b border-(--fuwari-border) pb-4 md:pb-6 last:border-b-0 last:pb-0"
                style={{ animationDelay: `${400 + i * 50}ms` }}
              >
                <p className="fuwari-text-80 whitespace-pre-wrap leading-relaxed transition-colors">
                  {moment.content}
                </p>
                <div className="mt-3 flex items-center gap-3 fuwari-text-40 text-xs transition-colors">
                  <Clock size={12} />
                  <span>{formatMomentDate(moment.createdAt)}</span>
                  {moment.author?.name ? (
                    <span className="font-mono">· {moment.author.name}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 fuwari-text-30 transition-colors">
            <p className="text-lg">{m.moments_no_moments()}</p>
          </div>
        )}

        {hasMore && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="fuwari-btn-primary px-6 py-2 rounded-xl font-bold flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
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
