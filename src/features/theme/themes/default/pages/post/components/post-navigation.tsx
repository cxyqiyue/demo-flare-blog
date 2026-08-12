import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { adjacentPostsQuery } from "@/features/posts/queries";
import { m } from "@/paraglide/messages";

interface PostNavigationProps {
  slug: string;
}

export function PostNavigation({ slug }: PostNavigationProps) {
  const { data } = useSuspenseQuery(adjacentPostsQuery(slug));
  const { previous, next } = data;

  return (
    <nav className="flex flex-col md:flex-row items-stretch justify-between gap-4 text-sm font-mono text-muted-foreground">
      {previous ? (
        <Link
          to="/post/$slug"
          params={{ slug: previous.slug }}
          className="group flex items-center gap-2 min-w-0 rounded-lg border border-border/30 px-4 py-3 hover:border-foreground/20 hover:text-foreground transition-colors"
        >
          <ChevronLeft
            size={14}
            className="shrink-0 group-hover:-translate-x-0.5 transition-transform"
          />
          <span className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] uppercase tracking-widest opacity-50">
              {m.post_prev()}
            </span>
            <span className="truncate text-sm">{previous.title}</span>
          </span>
        </Link>
      ) : (
        <div className="hidden md:flex flex-1" />
      )}

      {next ? (
        <Link
          to="/post/$slug"
          params={{ slug: next.slug }}
          className="group flex items-center justify-end gap-2 min-w-0 rounded-lg border border-border/30 px-4 py-3 hover:border-foreground/20 hover:text-foreground transition-colors"
        >
          <span className="flex flex-col gap-0.5 min-w-0 text-right">
            <span className="text-[10px] uppercase tracking-widest opacity-50">
              {m.post_next()}
            </span>
            <span className="truncate text-sm">{next.title}</span>
          </span>
          <ChevronRight
            size={14}
            className="shrink-0 group-hover:translate-x-0.5 transition-transform"
          />
        </Link>
      ) : (
        <div className="hidden md:flex flex-1" />
      )}
    </nav>
  );
}

export function PostNavigationSkeleton() {
  return (
    <div className="flex flex-col md:flex-row items-stretch justify-between gap-4">
      <div className="flex-1 h-14 rounded-lg bg-muted/40 animate-pulse" />
      <div className="flex-1 h-14 rounded-lg bg-muted/40 animate-pulse" />
    </div>
  );
}
