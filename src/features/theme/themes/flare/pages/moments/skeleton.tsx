import { m } from "@/paraglide/messages";
import { MomentSkeleton } from "./moment-skeleton";

export function MomentsPageSkeleton() {
  return (
    <div className="w-full space-y-4 md:space-y-6">
      <section className="flare-surface p-5 md:p-7 space-y-3">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          {m.moments_title()}
        </h1>
        <p className="max-w-2xl text-sm md:text-base text-muted-foreground leading-7">
          {m.moments_desc()}
        </p>
      </section>

      <section className="flare-surface p-4 md:p-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <MomentSkeleton key={i} />
        ))}
      </section>
    </div>
  );
}
