import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { MomentsPageProps } from "@/features/theme/contract/pages";
import { Pagination } from "@/features/theme/themes/flare/components/pagination";
import { m } from "@/paraglide/messages";
import { MomentCard } from "./moment-card";
import { MomentComposer } from "./moment-composer";

export function MomentsPage({
  moments,
  isAdmin,
  isSuperAdmin,
  currentUserId,
  onToggleLike,
  onCreateMoment,
  onUpdateMoment,
  onDeleteMoment,
  page,
  pageSize,
  total,
  hasPrevPage,
  hasNextPage,
  onPageChange,
}: MomentsPageProps) {
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <div className="flare-enter flex w-full flex-col gap-4">
      <section className="min-w-0 space-y-4 md:space-y-5">
        <header className="space-y-2 px-5 pb-5 pt-6 md:px-8 md:pt-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-[2.5rem]">
            {m.moments_title()}
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-[15px]">
            {m.moments_desc()}
          </p>
        </header>

        {isAdmin ? (
          <div className="border-t border-border/50 px-5 py-4 md:px-8">
            <button
              type="button"
              onClick={() => setComposerOpen((v) => !v)}
              className="flare-chip"
            >
              {composerOpen ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
              {m.moments_composer_title()}
            </button>
            {composerOpen ? (
              <div className="mt-4">
                <MomentComposer onCreate={onCreateMoment} />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="min-w-0">
          <div className="space-y-4 md:space-y-5">
            {moments.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-lg text-muted-foreground/60">
                  {m.moments_empty()}
                </p>
                <p className="mt-2 text-sm text-muted-foreground/50">
                  {m.moments_empty_desc()}
                </p>
              </div>
            ) : (
              <>
                {moments.map((moment) => (
                  <MomentCard
                    key={moment.id}
                    moment={moment}
                    isAdmin={isAdmin}
                    isSuperAdmin={isSuperAdmin}
                    currentUserId={currentUserId}
                    onToggleLike={onToggleLike}
                    onDelete={onDeleteMoment}
                    onUpdate={onUpdateMoment}
                  />
                ))}

                <Pagination
                  page={page}
                  total={total}
                  pageSize={pageSize}
                  hasPrevPage={hasPrevPage}
                  hasNextPage={hasNextPage}
                  onPageChange={onPageChange}
                />
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
