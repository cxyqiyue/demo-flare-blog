import type { MomentsPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";
import { Pagination } from "../../components/pagination";
import { MomentCard } from "./moment-card";
import { MomentComposer } from "./moment-composer";

export function MomentsPage({
  moments,
  isAdmin,
  onToggleLike,
  onCreateMoment,
  onDeleteMoment,
  page,
  pageSize,
  total,
  hasPrevPage,
  hasNextPage,
  onPageChange,
}: MomentsPageProps) {
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header Banner */}
      <div
        className="fuwari-card-base p-6 md:p-8 relative overflow-hidden flex flex-col items-center justify-center min-h-44 fuwari-onload-animation bg-linear-to-br from-(--fuwari-primary)/5 to-transparent"
        style={{ animationDelay: "150ms" }}
      >
        <h1 className="text-3xl md:text-4xl font-bold fuwari-text-90 mb-4 z-10 transition-colors">
          {m.moments_title()}
        </h1>
        <p className="fuwari-text-50 text-center max-w-xl z-10 transition-colors">
          {m.moments_desc()}
        </p>
      </div>

      {/* Admin Composer */}
      {isAdmin && (
        <div
          className="fuwari-onload-animation"
          style={{ animationDelay: "250ms" }}
        >
          <MomentComposer onCreate={onCreateMoment} />
        </div>
      )}

      {/* Moments List */}
      {moments.length > 0 ? (
        <>
          {moments.map((moment, i) => (
            <div
              key={moment.id}
              className="fuwari-onload-animation"
              style={{ animationDelay: `${300 + i * 50}ms` }}
            >
              <MomentCard
                moment={moment}
                isAdmin={isAdmin}
                onToggleLike={onToggleLike}
                onDelete={onDeleteMoment}
              />
            </div>
          ))}

          <div className="fuwari-card-base fuwari-onload-animation px-5 py-4 md:px-6 md:py-5">
            <Pagination
              page={page}
              total={total}
              pageSize={pageSize}
              hasPrevPage={hasPrevPage}
              hasNextPage={hasNextPage}
              onPageChange={onPageChange}
            />
          </div>
        </>
      ) : (
        <div className="fuwari-card-base p-6 md:p-8 fuwari-onload-animation flex-1">
          <div className="flex flex-col items-center justify-center py-20 fuwari-text-30 transition-colors">
            <p className="text-lg">{m.moments_empty()}</p>
          </div>
        </div>
      )}
    </div>
  );
}
