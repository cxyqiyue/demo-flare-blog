import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { adjacentPostsQuery } from "@/features/posts/queries";
import { m } from "@/paraglide/messages";

interface PostNavigationProps {
  slug: string;
}

export function PostNavigation({ slug }: PostNavigationProps) {
  const { data } = useSuspenseQuery(adjacentPostsQuery(slug));
  const { previous, next } = data;

  return (
    <div className="fuwari-card-base w-full px-5 py-4 md:px-6 md:py-5 fuwari-onload-animation">
      <div className="flex flex-col md:flex-row md:items-stretch justify-between gap-3">
        {previous ? (
          <Link
            to="/post/$slug"
            params={{ slug: previous.slug }}
            className="group min-w-0 flex-1 flex flex-col gap-1 rounded-lg px-3 py-2 transition-colors hover:bg-(--fuwari-btn-plain-bg-hover) active:bg-(--fuwari-btn-plain-bg-active)"
          >
            <span className="text-xl font-bold fuwari-text-90 flex items-center gap-1.5 transition-transform group-hover:-translate-x-0.5">
              <span>←</span>
              {m.post_prev()}
            </span>
            <span className="text-sm font-medium truncate group-hover:text-(--fuwari-primary) transition-colors">
              {previous.title}
            </span>
          </Link>
        ) : (
          <div className="hidden md:block flex-1" />
        )}

        {next ? (
          <Link
            to="/post/$slug"
            params={{ slug: next.slug }}
            className="group min-w-0 flex-1 flex flex-col gap-1 rounded-lg px-3 py-2 transition-colors hover:bg-(--fuwari-btn-plain-bg-hover) active:bg-(--fuwari-btn-plain-bg-active)"
          >
            <span className="text-xl font-bold fuwari-text-90 flex items-center justify-end gap-1.5 transition-transform group-hover:translate-x-0.5">
              {m.post_next()}
              <span>→</span>
            </span>
            <span className="text-sm font-medium truncate text-right group-hover:text-(--fuwari-primary) transition-colors">
              {next.title}
            </span>
          </Link>
        ) : (
          <div className="hidden md:block flex-1" />
        )}
      </div>
    </div>
  );
}

export function PostNavigationSkeleton() {
  return (
    <div className="fuwari-card-base w-full px-5 py-4 md:px-6 md:py-5">
      <div className="flex flex-col md:flex-row justify-between gap-3">
        <div className="flex-1">
          <div className="h-3 w-16 bg-black/10 dark:bg-white/10 rounded mb-2" />
          <div className="h-4 w-3/4 bg-black/10 dark:bg-white/10 rounded" />
        </div>
        <div className="flex-1">
          <div className="h-3 w-16 bg-black/10 dark:bg-white/10 rounded mb-2 ml-auto" />
          <div className="h-4 w-3/4 bg-black/10 dark:bg-white/10 rounded ml-auto" />
        </div>
      </div>
    </div>
  );
}
