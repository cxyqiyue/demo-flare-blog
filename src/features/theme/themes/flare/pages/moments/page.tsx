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
    <div className="w-full mx-auto pb-10 space-y-4 md:space-y-6">
      <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 md:p-7 shadow-sm">
        <header className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            {m.moments_title()}
          </h1>
          <p className="max-w-2xl text-sm md:text-base text-muted-foreground leading-7">
            {m.moments_desc()}
          </p>
        </header>
      </section>

      {/* Admin Composer (collapsible) */}
      {isAdmin && (
        <div className="mb-8">
          <button
            type="button"
            onClick={() => setComposerOpen((v) => !v)}
            className="flex items-center gap-2 text-sm font-serif font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            {composerOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {m.moments_composer_title()}
          </button>
          {composerOpen && <MomentComposer onCreate={onCreateMoment} />}
        </div>
      )}

      <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 md:p-6 shadow-sm">
      {/* Moments List */}
      <div className="space-y-4 md:space-y-5">
        {moments.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-serif text-lg text-muted-foreground/50">
              {m.moments_empty()}
            </p>
            <p className="mt-2 text-sm text-muted-foreground/30 font-mono">
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
      </section>
    </div>
  );
}
