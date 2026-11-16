import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { m } from "@/paraglide/messages";

export function AboutPageSkeleton() {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-3xl mx-auto pb-20 px-6 md:px-0">
      <nav className="py-12 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/posts" })}
          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-opacity"
        >
          <ArrowLeft size={12} />
          <span>{m.post_back_to_list()}</span>
        </button>
      </nav>

      <div className="space-y-16">
        <header className="space-y-8">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-4 w-16 bg-muted animate-pulse rounded-sm"></div>
              <div className="h-4 w-24 bg-muted animate-pulse rounded-sm"></div>
              <div className="h-4 w-20 bg-muted animate-pulse rounded-sm"></div>
            </div>

            <div className="space-y-4">
              <div className="h-12 md:h-16 w-full bg-muted animate-pulse rounded-sm"></div>
              <div className="h-12 md:h-16 w-3/4 bg-muted animate-pulse rounded-sm"></div>
            </div>
          </div>

          <div className="border-l-[1.5px] border-border pl-6 space-y-3">
            <div className="h-5 w-full bg-muted animate-pulse rounded-sm"></div>
            <div className="h-5 w-5/6 bg-muted animate-pulse rounded-sm"></div>
          </div>
        </header>

        <main className="max-w-none space-y-12">
          <div className="space-y-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-4">
                <div className="h-4 w-full bg-muted animate-pulse rounded-sm"></div>
                <div className="h-4 w-full bg-muted animate-pulse rounded-sm"></div>
                <div className="h-4 w-11/12 bg-muted animate-pulse rounded-sm"></div>
                <div className="h-4 w-full bg-muted animate-pulse rounded-sm"></div>
                <div className="h-4 w-4/5 bg-muted animate-pulse rounded-sm"></div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
