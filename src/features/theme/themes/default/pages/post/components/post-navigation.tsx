import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { adjacentPostsQuery } from "@/features/posts/queries";
import { m } from "@/paraglide/messages";

interface PostNavigationProps {
  slug: string;
}

export function PostNavigation({ slug }: PostNavigationProps) {
  const { data } = useSuspenseQuery(adjacentPostsQuery(slug));
  const { previous, next } = data;

  return (
    <nav className="flex items-center justify-between gap-6 text-sm font-mono text-muted-foreground">
      {previous ? (
        <Link
          to="/post/$slug"
          params={{ slug: previous.slug }}
          className="group flex items-center gap-2 min-w-0 hover:text-foreground transition-colors"
        >
          <ChevronLeft
            size={14}
            className="shrink-0 group-hover:-translate-x-0.5 transition-transform"
          />
          <span className="truncate">
            {m.post_prev()}: {previous.title}
          </span>
        </Link>
      ) : (
        <span aria-hidden />
      )}

      <Link
        to="/"
        className="flex items-center gap-1.5 shrink-0 uppercase tracking-widest text-[10px] opacity-40 hover:opacity-100 transition-opacity"
      >
        <Home size={12} />
        {m.post_home()}
      </Link>

      {next ? (
        <Link
          to="/post/$slug"
          params={{ slug: next.slug }}
          className="group flex items-center gap-2 min-w-0 text-right hover:text-foreground transition-colors"
        >
          <span className="truncate">
            {m.post_next()}: {next.title}
          </span>
          <ChevronRight
            size={14}
            className="shrink-0 group-hover:translate-x-0.5 transition-transform"
          />
        </Link>
      ) : (
        <span aria-hidden />
      )}
    </nav>
  );
}

export function PostNavigationSkeleton() {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="h-4 w-32 rounded bg-muted/40 animate-pulse" />
      <div className="h-4 w-12 rounded bg-muted/40 animate-pulse" />
      <div className="h-4 w-32 rounded bg-muted/40 animate-pulse" />
    </div>
  );
}
