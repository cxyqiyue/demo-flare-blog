import { useRouteContext } from "@tanstack/react-router";
import { useMemo } from "react";
import type { SiteConfig } from "@/features/config/site-config.schema";
import {
  resolveSocialHref,
  SOCIAL_PLATFORMS,
} from "@/features/config/utils/social-platforms";
import { useViewCounts } from "@/features/pageview/queries";
import type { HomePageProps } from "@/features/theme/contract/pages";
import { Pagination } from "@/features/theme/themes/flare/components/pagination";
import { PostItem } from "@/features/theme/themes/flare/components/post-item";
import { m } from "@/paraglide/messages";

export function HomePage({
  posts,
  page,
  pageSize,
  total,
  hasPrevPage,
  hasNextPage,
  onPageChange,
}: HomePageProps) {
  const { siteConfig } = useRouteContext({ from: "__root__" });

  const allSlugs = useMemo(() => posts.map((p) => p.slug), [posts]);
  const { data: viewCounts, isPending: isPendingViewCounts } =
    useViewCounts(allSlugs);

  return (
    <div className="flex flex-col w-full mx-auto py-6 md:py-10 space-y-6 md:space-y-8">
      {/* Intro card (banner already shows hero on home; keep concise on-page intro) */}
      <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 md:p-7 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{m.home_greeting()} 👋</p>
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
              {m.home_intro_prefix()}{" "}
              <span className="text-foreground">{siteConfig.author}</span>
              {m.home_intro_separator()}
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-7 max-w-3xl">
              {siteConfig.description}
            </p>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground shrink-0">
            {siteConfig.social
              .filter((link: SiteConfig["social"][number]) => link.url)
              .map((link: SiteConfig["social"][number], i: number) => {
                const preset =
                  link.platform !== "custom"
                    ? SOCIAL_PLATFORMS[link.platform]
                    : null;
                const Icon = preset?.icon;
                const label = preset?.label ?? link.label ?? "";
                const href = resolveSocialHref(link.platform, link.url);

                return (
                  <a
                    key={`${link.platform}-${i}`}
                    href={href}
                    target={link.platform === "email" ? undefined : "_blank"}
                    rel={link.platform === "email" ? undefined : "noreferrer"}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/60 hover:bg-muted/70 hover:text-foreground transition-colors"
                    aria-label={label}
                    title={label}
                  >
                    {Icon ? (
                      <Icon size={16} strokeWidth={1.75} />
                    ) : (
                      <img src={link.icon} alt={label} className="w-4 h-4" />
                    )}
                  </a>
                );
              })}
          </div>
        </div>
      </section>

      {/* Selected Posts */}
      {posts.length > 0 ? (
        <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 md:px-7 py-4 border-b border-border/40">
            <h2 className="text-base md:text-lg font-semibold text-foreground tracking-tight">
              {m.home_latest_posts()}
            </h2>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              {total}
            </span>
          </div>

          <div className="px-2 md:px-4">
            {posts.map((post) => (
              <div key={post.id} className="px-3 md:px-3">
                <PostItem
                  post={post}
                  pinned={post.pinnedAt != null}
                  views={viewCounts?.[post.slug]}
                  isLoadingViews={isPendingViewCounts}
                />
              </div>
            ))}
          </div>

          <div className="px-5 md:px-7 pb-5">
            <Pagination
              page={page}
              total={total}
              pageSize={pageSize}
              hasPrevPage={hasPrevPage}
              hasNextPage={hasNextPage}
              onPageChange={onPageChange}
            />
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-border/50 bg-card/70 p-10 text-center text-muted-foreground">
          {m.posts_no_posts?.() ?? ""}
        </section>
      )}
    </div>
  );
}
