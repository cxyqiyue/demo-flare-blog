import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Pencil, Share2, Sparkles } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sessionQuery } from "@/features/auth/queries";
import { PostGateShell } from "@/features/posts/components/post-gate-shell";
import type { PostPageProps } from "@/features/theme/contract/pages";
import { ContentRenderer } from "@/features/theme/themes/flare/components/content/content-renderer";
import { authClient } from "@/lib/auth/auth.client";
import { formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { CollapsibleChips } from "../../components/collapsible-chips";
import { CommentSection } from "../../components/comments/view/comment-section";
import {
  PostNavigation,
  PostNavigationSkeleton,
} from "./components/post-navigation";
import { RelatedPosts, RelatedPostsSkeleton } from "./components/related-posts";
import TableOfContents from "./components/table-of-contents";
import { TocDrawer } from "./components/toc-drawer";

export function PostPage({ post, hideAdminEdit }: PostPageProps) {
  const { data: authSession } = authClient.useSession();
  const { data: session } = useQuery({
    ...sessionQuery,
    enabled: Boolean(authSession?.user) && !hideAdminEdit,
  });
  const canEdit =
    !hideAdminEdit &&
    Boolean(authSession?.user && authSession.user.id === session?.user.id) &&
    Boolean(
      session?.user.isSuperAdmin ||
        (session?.user.role === "admin" && session.user.id === post.authorId),
    );

  return (
    <div
      className="flare-post-layout flare-enter"
      data-has-toc={Boolean(post.toc?.length)}
    >
      <div className="min-w-0 space-y-4 md:space-y-6">
        <article className="flare-surface">
          <div className="p-5 md:p-8 lg:p-10 space-y-8 md:space-y-10">
            <header className="space-y-6 md:space-y-7">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs md:text-[13px] text-muted-foreground/75">
                  {post.author ? (
                    <>
                      <span className="flex items-center gap-1.5">
                        {m.post_author()}:{" "}
                        <span className="text-foreground/90">
                          {post.author}
                        </span>
                      </span>
                      <span className="opacity-30">/</span>
                    </>
                  ) : null}
                  <span className="flex items-center gap-1.5">
                    {m.post_published_at()}:{" "}
                    <ClientOnly fallback={<span>-</span>}>
                      {formatDate(post.publishedAt)}
                    </ClientOnly>
                  </span>
                  <span className="opacity-30">/</span>
                  <span className="flex items-center gap-1.5">
                    {m.post_last_updated()}:{" "}
                    <ClientOnly fallback={<span>-</span>}>
                      {formatDate(post.updatedAt)}
                    </ClientOnly>
                  </span>
                  <span className="opacity-30">/</span>
                  <span>{m.read_time({ count: post.readTimeInMinutes })}</span>
                  {canEdit ? (
                    <Link
                      to="/admin/posts/edit/$id"
                      params={{ id: String(post.id) }}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-primary transition-colors hover:bg-primary/10"
                    >
                      <Pencil size={14} />
                      {m.post_edit()}
                    </Link>
                  ) : null}
                </div>
                {post.category || post.tags?.length ? (
                  <div className="text-sm text-muted-foreground">
                    <CollapsibleChips>
                      {post.category ? (
                        <Link
                          to="/posts"
                          search={{ categoryName: post.category.name }}
                          className="flare-chip"
                        >
                          {post.category.name}
                        </Link>
                      ) : null}
                      {post.tags?.map((tag) => (
                        <Link
                          key={tag.id}
                          to="/posts"
                          search={{ tagName: tag.name }}
                          className="flare-chip"
                        >
                          #{tag.name}
                        </Link>
                      ))}
                    </CollapsibleChips>
                  </div>
                ) : null}

                <h1
                  className="break-words text-2xl font-bold leading-[1.45] text-foreground sm:text-3xl lg:text-4xl"
                  style={{ viewTransitionName: `post-title-${post.slug}` }}
                >
                  {post.title}
                </h1>
              </div>

              {post.summary ? (
                <div className="space-y-2.5 rounded-xl border border-border/50 bg-muted/25 p-5 md:p-6">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                    <span>{m.post_summary_title()}</span>
                  </div>
                  <p className="text-base leading-relaxed text-muted-foreground md:text-[17px]">
                    {post.summary}
                  </p>
                </div>
              ) : null}
            </header>

            {/* Content Layout */}
            <div className="relative">
              {/* TOC drawer for small screens */}
              <TocDrawer headers={post.toc ?? []} />

              <div className="max-w-none min-w-0 text-foreground leading-relaxed">
                <ContentRenderer content={post.contentJson} />

                <footer className="mt-8 flex justify-center border-t border-border/50 pt-6 md:mt-10">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (navigator.share) {
                        try {
                          await navigator.share({
                            title: post.title,
                            url:
                              window.location.origin + window.location.pathname,
                          });
                        } catch (error) {
                          if (
                            !(
                              error instanceof DOMException &&
                              error.name === "AbortError"
                            )
                          )
                            toast.error(m.post_share_error());
                        }
                        return;
                      }
                      navigator.clipboard
                        .writeText(window.location.href)
                        .then(() => {
                          toast.success(m.post_share_success(), {
                            description: m.post_share_success_desc(),
                          });
                        })
                        .catch(() => {
                          toast.error(m.post_share_error(), {
                            description: m.post_share_error_desc(),
                          });
                        });
                    }}
                    className="rounded-full gap-2"
                  >
                    <Share2 size={14} strokeWidth={1.75} />
                    <span>{m.post_share()}</span>
                  </Button>
                </footer>
              </div>
            </div>
          </div>
        </article>

        <Suspense fallback={<PostNavigationSkeleton />}>
          <PostNavigation slug={post.slug} />
        </Suspense>

        <Suspense fallback={<RelatedPostsSkeleton />}>
          <RelatedPosts slug={post.slug} />
        </Suspense>

        {/* Comments Section */}
        <div className="flare-surface p-5 md:p-8">
          <CommentSection postId={post.id} />
        </div>
      </div>
      {post.toc?.length ? (
        <aside className="flare-post-toc" aria-label={m.post_toc()}>
          <div className="sticky top-24">
            <TableOfContents
              headers={post.toc}
              className="static w-full max-h-[calc(100dvh-10rem)]"
            />
          </div>
        </aside>
      ) : null}

      {/* 受限文章门禁：未解锁时以毛玻璃遮罩覆盖全页，不泄露正文 */}
      <PostGateShell post={post} />
    </div>
  );
}
function ClientOnly({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  return <>{isMounted ? children : fallback}</>;
}
