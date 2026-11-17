import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { m } from "@/paraglide/messages";

export function AboutPageSkeleton() {
  const navigate = useNavigate();

  return (
    <div className="w-full space-y-4 md:space-y-6">
      <nav className="flex items-center justify-between px-0.5">
        <button
          onClick={() => navigate({ to: "/posts" })}
          className="flare-chip"
        >
          <ArrowLeft size={14} />
          <span>{m.post_back_to_list()}</span>
        </button>
      </nav>

      <article className="flare-surface p-5 md:p-8 lg:p-10 space-y-8">
        <header className="space-y-4">
          <div className="h-10 md:h-14 w-3/4 bg-muted animate-pulse rounded-md" />
          <div className="h-4 w-full bg-muted/70 animate-pulse rounded-sm" />
          <div className="h-4 w-5/6 bg-muted/70 animate-pulse rounded-sm" />
        </header>
        <main className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-full bg-muted animate-pulse rounded-sm" />
              <div className="h-4 w-11/12 bg-muted animate-pulse rounded-sm" />
              <div className="h-4 w-4/5 bg-muted animate-pulse rounded-sm" />
            </div>
          ))}
        </main>
      </article>
    </div>
  );
}
