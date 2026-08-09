import { m } from "@/paraglide/messages";

export function MomentsPageSkeleton() {
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

      {/* Loading List */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="py-6 border-b border-border/20">
            <div className="h-4 bg-muted/60 rounded-sm animate-pulse w-3/4" />
            <div className="mt-2 h-4 bg-muted/40 rounded-sm animate-pulse w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
