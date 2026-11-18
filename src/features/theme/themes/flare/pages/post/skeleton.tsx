import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { POSTS_KEYS } from "@/features/posts/queries";
import type { PostListItem } from "@/features/posts/schema/posts.schema";

export function PostPageSkeleton() {
  const { slug } = useParams({ from: "/_public/post/$slug" });
  const queryClient = useQueryClient();

  // Optimistic UI: Try to get the post title from cache to verify transition immediately
  const cachedPost = queryClient
    .getQueriesData<unknown>({ queryKey: POSTS_KEYS.all })
    .map(([, data]) => data)
    .filter(Boolean)
    .flatMap((data) => {
      // Handle regular arrays (e.g. from recentPostsQuery)
      if (Array.isArray(data)) {
        return data as Array<PostListItem>;
      }
      // Handle infinite query pages
      if (typeof data === "object" && data !== null && "pages" in data) {
        const infiniteData = data as {
          pages: Array<{ items: Array<PostListItem> }>;
        };
        return infiniteData.pages.flatMap((p) => p.items);
      }
      return [];
    })
    .find((p) => p.slug === slug);

  return (
    <div className="w-full space-y-4 md:space-y-6">
      <article className="flare-surface overflow-hidden">
        <div className="p-5 md:p-8 lg:p-10 space-y-8">
          <header className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-4 w-24 bg-muted animate-pulse rounded-sm" />
              <div className="h-4 w-28 bg-muted animate-pulse rounded-sm" />
              <div className="h-4 w-20 bg-muted animate-pulse rounded-sm" />
            </div>
            {cachedPost ? (
              <h1
                className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-[1.45] text-foreground"
                style={{ viewTransitionName: `post-title-${cachedPost.slug}` }}
              >
                {cachedPost.title}
              </h1>
            ) : (
              <div className="space-y-3">
                <div className="h-12 md:h-14 w-full bg-muted animate-pulse rounded-sm" />
                <div className="h-12 md:h-14 w-3/4 bg-muted animate-pulse rounded-sm" />
              </div>
            )}
            <div className="rounded-lg border border-border/40 bg-muted/20 p-5 space-y-2">
              <div className="h-4 w-32 bg-muted animate-pulse rounded-sm" />
              <div className="h-4 w-full bg-muted animate-pulse rounded-sm" />
              <div className="h-4 w-5/6 bg-muted animate-pulse rounded-sm" />
            </div>
          </header>

          <main className="max-w-none space-y-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-4 w-full bg-muted animate-pulse rounded-sm" />
                <div className="h-4 w-full bg-muted animate-pulse rounded-sm" />
                <div className="h-4 w-11/12 bg-muted animate-pulse rounded-sm" />
                <div className="h-4 w-4/5 bg-muted animate-pulse rounded-sm" />
                {i === 2 && (
                  <div className="my-6 h-56 w-full bg-muted animate-pulse rounded-lg" />
                )}
              </div>
            ))}
          </main>
        </div>
      </article>
    </div>
  );
}
