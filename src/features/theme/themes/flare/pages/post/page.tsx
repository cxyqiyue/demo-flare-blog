import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowUp, Pencil, Share2, Sparkles } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PostGateShell } from "@/features/posts/components/post-gate-shell";
import type { PostPageProps } from "@/features/theme/contract/pages";
import { ContentRenderer } from "@/features/theme/themes/flare/components/content/content-renderer";
import { authClient } from "@/lib/auth/auth.client";
import { formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { CommentSection } from "../../components/comments/view/comment-section";
import {
  PostNavigation,
  PostNavigationSkeleton,
} from "./components/post-navigation";
import { RelatedPosts, RelatedPostsSkeleton } from "./components/related-posts";
import TableOfContents from "./components/table-of-contents";
import { TocDrawer } from "./components/toc-drawer";

export function PostPage({ post, hideAdminEdit }: PostPageProps) {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="w-full space-y-4 md:space-y-6 flare-enter">
      <nav className="flex items-center justify-between gap-2 px-0.5">
        <button
          onClick={() => navigate({ to: "/posts" })}
          className="flare-chip"
        >
          <ArrowLeft size={14} />
          <span>{m.post_back_to_list()}</span>
        </button>
        {session?.user.role === "admin" && !hideAdminEdit && (
          <Link
            to="/admin/posts/edit/$id"
            params={{ id: String(post.id) }}
            className="flare-chip"
          >
            <Pencil size={14} />
            <span>{m.post_edit()}</span>
          </Link>
        )}
      </nav>

      <article className="flare-surface overflow-hidden">
        <div className="p-5 md:p-8 lg:p-10 space-y-8 md:space-y-10">
          <header className="space-y-6 md:space-y-7">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs md:text-[13px] text-muted-foreground/75">
                {post.author ? (
                  <>
                    <span className="flex items-center gap-1.5">
                      {m.post_author()}: <span className="text-foreground/90">{post.author}</span>
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

                {post.tags && post.tags.length > 0 ? (
                  <>
                    <span className="opacity-30">/</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {post.tags.map((tag) => (
                        <Link
                          key={tag.id}
                          to="/posts"
                          search={{ tagName: tag.name }}
                          className="hover:text-foreground transition-colors"
                        >
                          #{tag.name}
                        </Link>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>

              <h1
                className="text-3xl md:text-5xl lg:text-[3.2rem] font-semibold leading-[1.12] tracking-tight text-foreground"
                style={{ viewTransitionName: `post-title-${post.slug}` }}
              >
                {post.title}
              </h1>
            </div>

            {post.summary ? (
              <div className="bg-muted/25 rounded-2xl p-5 md:p-6 space-y-2.5 border border-border/40">
                <div className="flex items-center gap-2 text-muted-foreground/85 font-medium text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>{m.post_summary_title()}</span>
                </div>
                <p className="text-base md:text-lg leading-relaxed text-muted-foreground">
                  {post.summary}
                </p>
              </div>
            ) : null}
          </header>

          {/* Content Layout */}
          <div className="relative">
            {/* Floating TOC for Large Screens */}
            <aside className="hidden xl:block absolute left-full ml-12 top-0 h-full">
              <div className="sticky top-32 w-60">
                <TableOfContents headers={post.toc ?? []} />
              </div>
            </aside>

            {/* TOC drawer for small screens */}
            <TocDrawer headers={post.toc ?? []} />

            <main className="max-w-none min-w-0 overflow-x-clip text-foreground leading-relaxed">
              <ContentRenderer content={post.contentJson} />

              <footer className="mt-16 md:mt-20 pt-6 md:pt-8 border-t border-border/30 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6">
                <div className="flex items-center gap-3 text-sm text-muted-foreground/70">
                  <span>{m.post_end_notice()}</span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
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
            </main>
          </div>

          {/* Prev/Next Navigation */}
          <div className="pt-16 border-t border-border/40">
            <Suspense fallback={<PostNavigationSkeleton />}>
              <PostNavigation slug={post.slug} />
            </Suspense>
          </div>

          {/* Related Posts */}
          <div className="pt-24 border-t border-border/40">
            <Suspense fallback={<RelatedPostsSkeleton />}>
              <RelatedPosts slug={post.slug} />
            </Suspense>
          </div>

          {/* Comments Section */}
          <div className="pt-10 border-t border-border/30">
            <CommentSection postId={post.id} />
          </div>
        </div>
      </article>

      {/* Back To Top */}
      <div
        className={`fixed bottom-8 right-8 z-40 transition-all duration-700 ${
          showBackToTop
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-10 pointer-events-none"
        }`}
      >
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="group flex flex-col items-center gap-1.5"
        >
          <ArrowUp
            size={16}
            className="text-muted-foreground/60 group-hover:text-foreground group-hover:-translate-y-1 transition-all duration-300"
          />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/40 group-hover:text-foreground transition-colors duration-300">
            {m.post_back_to_top()}
          </span>
        </button>
      </div>

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
