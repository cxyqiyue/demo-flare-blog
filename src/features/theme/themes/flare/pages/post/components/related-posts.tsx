import { useSuspenseQuery } from "@tanstack/react-query";
import { ClientOnly, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { relatedPostsQuery } from "@/features/posts/queries";
import { formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { config } from "../../../config";

interface RelatedPostsProps {
  slug: string;
}

export function RelatedPosts({ slug }: RelatedPostsProps) {
  const { data: posts } = useSuspenseQuery(
    relatedPostsQuery(slug, config.post.relatedPostsLimit),
  );

  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-muted-foreground/70 font-medium text-xs uppercase tracking-widest">
        <span className="opacity-50">///</span>
        <span>{m.post_related_posts()}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {posts.map((post) => (
          <Link
            key={post.id}
            to="/post/$slug"
            params={{ slug: post.slug }}
            className="group flex flex-col h-full rounded-xl border border-border/50 bg-background/40 p-4 hover:bg-muted/30 hover:border-border/70 transition-colors"
          >
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 tracking-wider">
              <span>
                <ClientOnly fallback="-">
                  {formatDate(post.publishedAt)}
                </ClientOnly>
              </span>
              <span className="opacity-30">/</span>
              <span>{m.read_time({ count: post.readTimeInMinutes })}</span>
            </div>

            <h3 className="mt-2 text-base md:text-lg font-medium leading-snug text-foreground group-hover:text-foreground/85 transition-colors line-clamp-2">
              {post.title}
            </h3>

            <div className="pt-3 mt-auto flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70 group-hover:text-foreground transition-colors">
              <span>{m.post_read_more()}</span>
              <ArrowRight
                size={12}
                className="-ml-0.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300"
              />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function RelatedPostsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-muted-foreground/60 font-medium text-xs uppercase tracking-widest">
        <span className="opacity-50">///</span>
        <Skeleton className="h-3 w-16" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-3 w-24 opacity-60" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
