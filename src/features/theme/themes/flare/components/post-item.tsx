import { ClientOnly, Link } from "@tanstack/react-router";
import { ArrowUpRight, Eye, Pin, User } from "lucide-react";
import { memo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { PostItem as PostItemType } from "@/features/posts/schema/posts.schema";
import { formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";

interface PostItemProps {
  post: PostItemType;
  pinned?: boolean;
  views?: number;
  isLoadingViews?: boolean;
}

export const PostItem = memo(
  ({ post, pinned, views, isLoadingViews }: PostItemProps) => {
    return (
      <article className="flare-post-card flare-surface group relative overflow-hidden">
        <Link
          to="/post/$slug"
          params={{ slug: post.slug }}
          className="block h-full p-5 sm:p-6 lg:p-7"
        >
          <div className="flex h-full flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-muted-foreground">
              <time
                dateTime={post.publishedAt?.toISOString()}
                className="whitespace-nowrap tabular-nums"
              >
                <ClientOnly fallback="-">
                  {formatDate(post.publishedAt)}
                </ClientOnly>
              </time>
              {post.author ? (
                <>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <User size={12} />
                    {post.author}
                  </span>
                </>
              ) : null}
              {post.tags && post.tags.length > 0 ? (
                <>
                  <span className="text-border">·</span>
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span key={tag.id} className="whitespace-nowrap">
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
              {isLoadingViews ? (
                <>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <Eye size={12} />
                    <Skeleton className="h-3 w-10 rounded bg-muted-foreground/20" />
                  </span>
                </>
              ) : views !== undefined ? (
                <>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap tabular-nums">
                    <Eye size={12} />
                    {m.post_views_count({ count: views })}
                  </span>
                </>
              ) : null}
            </div>

            <h3
              className="flex items-start gap-2 text-xl font-bold leading-relaxed text-foreground transition-colors duration-200 group-hover:text-primary md:text-2xl"
              style={{ viewTransitionName: `post-title-${post.slug}` }}
            >
              {pinned ? (
                <Pin
                  size={15}
                  className="mt-1.5 shrink-0 text-muted-foreground/60"
                  strokeWidth={1.75}
                />
              ) : null}
              <span className="line-clamp-3 break-words">{post.title}</span>
            </h3>

            {post.summary ? (
              <p className="line-clamp-3 text-[15px] leading-7 text-muted-foreground">
                {post.summary}
              </p>
            ) : null}
            <div className="mt-auto flex justify-end pt-2" aria-hidden="true">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <ArrowUpRight size={18} />
              </span>
            </div>
          </div>
        </Link>
      </article>
    );
  },
);

PostItem.displayName = "PostItem";
