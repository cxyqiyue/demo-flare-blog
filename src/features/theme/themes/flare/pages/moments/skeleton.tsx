import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages";
import { MomentSkeleton } from "./moment-skeleton";

export function MomentsPageSkeleton() {
  return (
    <div className="w-full mx-auto pb-10 space-y-4 md:space-y-6">
      <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 md:p-7 shadow-sm space-y-3">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          {m.moments_title()}
        </h1>
        <p className="max-w-2xl text-sm md:text-base text-muted-foreground leading-7">
          {m.moments_desc()}
        </p>
      </section>

      <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 md:p-6 shadow-sm space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <MomentSkeleton key={i} />
        ))}
      </section>
    </div>
  );
}
