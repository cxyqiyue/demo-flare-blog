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

  if (!previous && !next) return null;

  return (
    <nav
      aria-label={m.post_navigation_aria_label()}
      className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm"
    >
      {previous ? (
        <Link
          to="/post/$slug"
          params={{ slug: previous.slug }}
          className="group flex min-h-24 min-w-0 items-center gap-3 flare-surface px-5 py-4 transition-colors hover:bg-muted/30"
        >
          <ChevronLeft
            size={16}
            className="shrink-0 text-muted-foreground group-hover:-translate-x-0.5 transition-transform"
          />
          <span className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs text-muted-foreground">
              {m.post_prev()}
            </span>
            <span className="line-clamp-2 break-words text-foreground/90 font-medium">
              {previous.title}
            </span>
          </span>
        </Link>
      ) : null}

      {next ? (
        <Link
          to="/post/$slug"
          params={{ slug: next.slug }}
          className="group flex min-h-24 min-w-0 items-center justify-end gap-3 flare-surface px-5 py-4 transition-colors hover:bg-muted/30 sm:col-start-2"
        >
          <span className="flex flex-col gap-0.5 min-w-0 text-right">
            <span className="text-xs text-muted-foreground">
              {m.post_next()}
            </span>
            <span className="line-clamp-2 break-words text-foreground/90 font-medium">
              {next.title}
            </span>
          </span>
          <ChevronRight
            size={16}
            className="shrink-0 text-muted-foreground group-hover:translate-x-0.5 transition-transform"
          />
        </Link>
      ) : null}
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
