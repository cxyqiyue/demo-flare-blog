import type { MomentsPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";
import { MomentCard } from "./moment-card";
import { MomentComposer } from "./moment-composer";

export function MomentsPage({
  moments,
  isAdmin,
  onToggleLike,
  onCreateMoment,
  onDeleteMoment,
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
      </header>

      {/* Admin Composer */}
      {isAdmin && <MomentComposer onCreate={onCreateMoment} />}

      {/* Moments List */}
      <div className="space-y-6">
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
          moments.map((moment) => (
            <MomentCard
              key={moment.id}
              moment={moment}
              isAdmin={isAdmin}
              onToggleLike={onToggleLike}
              onDelete={onDeleteMoment}
            />
          ))
        )}
      </div>
    </div>
  );
}
