import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useRouteContext } from "@tanstack/react-router";
import { ArrowDown, Hash, UserRound } from "lucide-react";
import { useMemo } from "react";
import {
  resolveSocialHref,
  SOCIAL_PLATFORMS,
  type SocialLink,
} from "@/features/config/utils/social-platforms";
import type { PublicLayoutProps } from "@/features/theme/contract/layouts";
import { tagsQueryOptions } from "@/features/tags/queries";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { Footer } from "./footer";
import { Navbar } from "./navbar";

const BANNER_HEIGHT_HOME = 78;
const BANNER_HEIGHT_PAGE = 32;
const BANNER_HEIGHT_FOCUSED = 24;
const NAVBAR_CLEARANCE_REM = 4.75;

function isFocusedPath(pathname: string) {
  return (
    pathname.startsWith("/search") ||
    pathname.startsWith("/friend-links/submit") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email")
  );
}

function Sidebar({
  showTags = true,
}: {
  showTags?: boolean;
}) {
  const { siteConfig } = useRouteContext({ from: "__root__" });
  const { data: tags } = useQuery({
    ...tagsQueryOptions,
    enabled: showTags,
  });

  const avatar =
    siteConfig.theme?.flare?.avatar || siteConfig.theme?.fuwari?.avatar || "";
  const socialLinks = siteConfig.social.filter(
    (link: SocialLink) => Boolean(link.url),
  );
  const topTags = (tags ?? []).slice(0, 18);

  return (
    <aside className="flare-sidebar" aria-label="Sidebar">
      <section className="flare-surface-soft p-5 md:p-6">
        <div className="flex items-start gap-4">
          {avatar ? (
            <img
              src={avatar}
              alt={siteConfig.author || siteConfig.title}
              className="h-14 w-14 rounded-2xl object-cover border border-border/50 shadow-sm"
            />
          ) : (
            <div className="h-14 w-14 rounded-2xl border border-border/50 bg-muted/50 flex items-center justify-center text-muted-foreground">
              <UserRound size={20} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold tracking-tight text-foreground truncate">
              {siteConfig.author || siteConfig.title}
            </p>
            {siteConfig.tagline || siteConfig.description ? (
              <p className="mt-1 text-sm leading-6 text-muted-foreground line-clamp-3">
                {siteConfig.tagline || siteConfig.description}
              </p>
            ) : null}
          </div>
        </div>
        {socialLinks.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {socialLinks.map((link: SocialLink, i: number) => {
              const preset =
                link.platform === "custom" ? null : SOCIAL_PLATFORMS[link.platform];
              const Icon = preset?.icon;
              const label = preset?.label ?? link.label ?? link.platform;
              const href = resolveSocialHref(link.platform, link.url);
              return (
                <a
                  key={`${link.platform}-${i}`}
                  href={href}
                  target={link.platform === "email" ? undefined : "_blank"}
                  rel={link.platform === "email" ? undefined : "noreferrer"}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  aria-label={label}
                  title={label}
                >
                  {Icon ? (
                    <Icon size={15} strokeWidth={1.75} />
                  ) : link.icon ? (
                    <img src={link.icon} alt={label} className="h-4 w-4" />
                  ) : (
                    <UserRound size={14} />
                  )}
                </a>
              );
            })}
          </div>
        ) : null}
      </section>

      {showTags ? (
        <section className="flare-surface-soft p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-foreground flex items-center gap-2">
              <Hash size={15} className="text-muted-foreground" />
              {m.posts_tags_filter?.() ?? "Tags"}
            </h2>
            <Link
              to="/posts"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {m.nav_posts?.() ?? "Posts"}
            </Link>
          </div>
          {topTags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {topTags.map((tag) => (
                <Link
                  key={tag.id}
                  to="/posts"
                  search={{ tagName: tag.name }}
                  className="flare-chip"
                  title={`${tag.name} (${tag.postCount ?? 0})`}
                >
                  <span className="truncate max-w-[9rem]">{tag.name}</span>
                  {typeof tag.postCount === "number" ? (
                    <span className="text-[11px] opacity-70 tabular-nums">
                      {tag.postCount}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {m.posts_no_posts?.() ?? ""}
            </p>
          )}
        </section>
      ) : null}
    </aside>
  );
}

export function PublicLayout({
  children,
  navOptions,
  user,
  isSessionLoading,
  logout,
}: PublicLayoutProps) {
  const { siteConfig } = useRouteContext({ from: "__root__" });
  const pathname = useLocation({ select: (l) => l.pathname });
  const isHome = pathname === "/";
  const isPost = pathname.startsWith("/post/");
  const focused = isFocusedPath(pathname);
  const bannerHeightVh = isHome
    ? BANNER_HEIGHT_HOME
    : focused
      ? BANNER_HEIGHT_FOCUSED
      : BANNER_HEIGHT_PAGE;
  const bannerImage =
    siteConfig.theme?.flare?.homeBg || siteConfig.theme?.fuwari?.homeBg || "";
  const avatar =
    siteConfig.theme?.flare?.avatar || siteConfig.theme?.fuwari?.avatar || "";

  const showSidebar = !focused && !isPost && !pathname.startsWith("/friend-links/submit");
  const isReadingPage = isPost || pathname.startsWith("/friend-links/submit");
  const pageInsetClass = useMemo(
    () =>
      cn(
        "mx-auto w-full px-4 md:px-6",
        isReadingPage
          ? "max-w-[min(var(--flare-reading-width),calc(100%-2rem))] md:max-w-[var(--flare-reading-width)]"
          : "max-w-[var(--flare-page-width)]",
      ),
    [isReadingPage],
  );

  const bodyOverlap = isHome ? "3.5rem" : "2.75rem";

  return (
    <div
      className="flare-shell"
      data-flare-home={isHome ? "true" : "false"}
      data-flare-focused={focused ? "true" : "false"}
    >
      {bannerImage ? (
        <div className="flare-ambient" aria-hidden="true">
          <img src={bannerImage} alt="" decoding="async" />
        </div>
      ) : null}

      <div className="sticky top-0 z-50 pointer-events-none">
        <div className={cn("pointer-events-auto", pageInsetClass, !isReadingPage && "md:px-4")}>
          <Navbar
            navOptions={navOptions}
            user={user}
            isLoading={isSessionLoading}
            logout={logout}
            bannerHeightVh={bannerHeightVh}
          />
        </div>
      </div>

      <section
        className="flare-banner"
        style={{ height: `${bannerHeightVh}vh` }}
        aria-label={isHome ? "Hero banner" : undefined}
      >
        {bannerImage ? (
          <img
            src={bannerImage}
            alt=""
            className="flare-banner-image"
            fetchPriority={isHome ? "high" : "auto"}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-muted/70 via-muted/40 to-background" />
        )}
        <div className="flare-banner-overlay" />

        {isHome ? (
          <div className={cn("flare-hero", pageInsetClass, "md:px-10")}>
            <div className="max-w-3xl text-white drop-shadow-[0_8px_30px_rgba(0,0,0,0.28)] flare-enter">
              <h1 className="text-4xl font-semibold tracking-tight leading-[1.03] md:text-6xl lg:text-[4rem]">
                {siteConfig.title}
              </h1>
              {siteConfig.description ? (
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/90 md:text-lg md:leading-8">
                  {siteConfig.description}
                </p>
              ) : siteConfig.tagline ? (
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/90 md:text-lg md:leading-8">
                  {siteConfig.tagline}
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-white/90 md:text-base">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={siteConfig.author || siteConfig.title}
                    className="h-8 w-8 rounded-full border border-white/35 object-cover"
                  />
                ) : null}
                {siteConfig.author ? (
                  <span className="font-medium">{siteConfig.author}</span>
                ) : null}
              </div>
              <button
                type="button"
                className="mt-8 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20 hover:translate-y-[1px]"
                aria-label={m.common_open_menu?.() ?? "Scroll to content"}
                onClick={() =>
                  window.scrollTo({
                    top: Math.max(
                      0,
                      window.innerHeight * (bannerHeightVh / 100) - 96,
                    ),
                    behavior: "smooth",
                  })
                }
              >
                <ArrowDown size={18} />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <div
        className={cn("flare-body", pageInsetClass, "pb-10 md:pb-14")}
        style={{
          marginTop: `calc(${bannerHeightVh}vh - ${bodyOverlap} - ${NAVBAR_CLEARANCE_REM})`,
          paddingTop: "0.5rem",
        }}
      >
        <div
          className={cn(
            "flare-grid",
            showSidebar ? "lg:grid-cols-[minmax(0,1fr)_18rem]" : "",
          )}
          data-has-sidebar={showSidebar ? "true" : "false"}
        >
          <main className="min-w-0 space-y-4 md:space-y-6" data-shell-region="main">
            {children}
          </main>

          {showSidebar ? (
            <div className="flare-sidebar-sticky self-start">
              <Sidebar showTags />
            </div>
          ) : null}
        </div>

        <div className="mt-8 md:mt-10" data-shell-region="footer">
          <Footer navOptions={navOptions} />
        </div>
      </div>
    </div>
  );
}
