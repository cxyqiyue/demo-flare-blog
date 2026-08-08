import { m } from "@/paraglide/messages";
import { MomentSkeleton } from "./moment-skeleton";

export function MomentsPageSkeleton() {
  return (
    <div className="w-full max-w-3xl mx-auto pb-20 px-6 md:px-0">
      <header className="py-12 md:py-20 space-y-6">
        <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight text-foreground">
          {m.moments_title()}
        </h1>
        <p className="max-w-xl text-base md:text-lg font-light text-muted-foreground leading-relaxed">
          {m.moments_desc()}
        </p>
      </header>

      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <MomentSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
