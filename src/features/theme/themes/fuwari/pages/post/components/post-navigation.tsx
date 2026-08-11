import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { adjacentPostsQuery } from "@/features/posts/queries";
import { m } from "@/paraglide/messages";

interface PostNavigationProps {
  slug: string;
}

export function PostNavigation({ slug }: PostNavigationProps) {
  const { data } = useSuspenseQuery(adjacentPostsQuery(slug));
  const { previous, next } = data;

  return (
    <div className="hidden md:flex flex-row justify-between gap-4 overflow-hidden w-full fuwari-onload-animation">
      {previous ? (
        <Link
          to="/post/$slug"
          params={{ slug: previous.slug }}
          className="fuwari-card-base px-5 py-4 rounded-(--fuwari-radius-large) min-w-0 flex-1 group transition-colors hover:bg-(--fuwari-btn-regular-bg-hover)"
        >
          <div className="text-xs fuwari-text-50 mb-1.5 flex items-center gap-1">
            <span className="inline-block transition-transform group-hover:-translate-x-0.5">
              ←
            </span>
            {m.post_prev()}
          </div>
          <div className="text-sm font-medium truncate group-hover:text-(--fuwari-primary) transition-colors">
            {previous.title}
          </div>
        </Link>
      ) : (
        <div className="flex-1" />
      )}

      <Link
        to="/"
        className="fuwari-btn-regular h-10 px-4 rounded-lg flex items-center gap-2 text-sm shrink-0 active:scale-95 transition-all self-center"
      >
        <Home size={15} />
        {m.post_home()}
      </Link>

      {next ? (
        <Link
          to="/post/$slug"
          params={{ slug: next.slug }}
          className="fuwari-card-base px-5 py-4 rounded-(--fuwari-radius-large) min-w-0 flex-1 group transition-colors hover:bg-(--fuwari-btn-regular-bg-hover)"
        >
          <div className="text-xs fuwari-text-50 mb-1.5 flex items-center justify-end gap-1">
            {m.post_next()}
            <span className="inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </div>
          <div className="text-sm font-medium truncate text-right group-hover:text-(--fuwari-primary) transition-colors">
            {next.title}
          </div>
        </Link>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}

export function PostNavigationSkeleton() {
  return (
    <div className="hidden md:flex flex-row justify-between gap-4 w-full">
      <div className="fuwari-card-base flex-1 px-5 py-4 rounded-(--fuwari-radius-large)">
        <div className="h-3 w-12 bg-black/10 dark:bg-white/10 rounded mb-2" />
        <div className="h-4 w-3/4 bg-black/10 dark:bg-white/10 rounded" />
      </div>
      <div className="fuwari-btn-regular h-10 w-28 rounded-lg animate-pulse" />
      <div className="fuwari-card-base flex-1 px-5 py-4 rounded-(--fuwari-radius-large)">
        <div className="h-3 w-12 bg-black/10 dark:bg-white/10 rounded mb-2" />
        <div className="h-4 w-3/4 bg-black/10 dark:bg-white/10 rounded" />
      </div>
    </div>
  );
}
