import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useRouteContext } from "@tanstack/react-router";
import { ArrowDown, Hash, UserRound } from "lucide-react";
import { useMemo } from "react";
import {
  resolveSocialHref,
  SOCIAL_PLATFORMS,
  type SocialLink,
} from "@/features/config/utils/social-platforms";
import { tagsQueryOptions } from "@/features/tags/queries";
import type { PublicLayoutProps } from "@/features/theme/contract/layouts";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { Footer } from "./footer";
import { Navbar } from "./navbar";

const BANNER_HEIGHT_HOME = 78;
const BANNER_HEIGHT_PAGE = 44;
const BANNER_HEIGHT_FOCUSED = 24;

function isFocusedPath(pathname: string) {
  return (
    pathname.startsWith("/search") ||
    pathname.startsWith("/friend-links/submit") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/unsubscribe")
  );
}

/**
 * The two sidebar widgets. On the home page they lead the content as one slim
 * strip; on every other page they follow it, as the reference site does.
 */
function SidebarWidgets({ place }: { place: "before" | "after" }) {
  const { siteConfig } = useRouteContext({ from: "__root__" });
  const { data: tags } = useQuery(tagsQueryOptions);

  const avatar =
    siteConfig.theme?.flare?.avatar || siteConfig.theme?.fuwari?.avatar || "";
  const socialLinks = siteConfig.social.filter((link: SocialLink) =>
    Boolean(link.url),
  );
  const topTags = (tags ?? []).slice(0, 24);

  return (
    <div className="flare-widgets" data-place={place}>
      <section className="flare-widget flare-surface flex flex-col gap-4 p-5">
        <div className="flex items-center gap-4">
          {avatar ? (
            <img
              src={avatar}
              alt={siteConfig.author || siteConfig.title}
              className="h-14 w-14 shrink-0 rounded-2xl border border-border/50 bg-muted/30 object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border/50 bg-muted/40 text-muted-foreground">
              <UserRound size={20} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold tracking-tight text-foreground">
              {siteConfig.author || siteConfig.title}
            </p>
            {siteConfig.tagline || siteConfig.description ? (
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {siteConfig.tagline || siteConfig.description}
              </p>
            ) : null}
          </div>
        </div>
        {socialLinks.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {socialLinks.map((link: SocialLink, i: number) => {
              const preset =
                link.platform === "custom"
                  ? null
                  : SOCIAL_PLATFORMS[link.platform];
              const Icon = preset?.icon;
              const label = preset?.label ?? link.label ?? link.platform;
              const href = resolveSocialHref(link.platform, link.url);
              return (
                <a
                  key={`${link.platform}-${i}`}
                  href={href}
                  target={link.platform === "email" ? undefined : "_blank"}
                  rel={link.platform === "email" ? undefined : "noreferrer"}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground"
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

      <section className="flare-widget flare-surface flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Hash size={15} className="text-muted-foreground" />
            {m.posts_tags_filter?.() ?? "Tags"}
          </h2>
          <Link
            to="/posts"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {m.nav_posts?.() ?? "Posts"}
          </Link>
        </div>
        {topTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {topTags.map((tag) => (
              <Link
                key={tag.id}
                to="/posts"
                search={{ tagName: tag.name }}
                className="flare-chip"
                title={`${tag.name}${typeof tag.postCount === "number" ? ` (${tag.postCount})` : ""}`}
              >
                <span className="max-w-[8.5rem] truncate">{tag.name}</span>
                {typeof tag.postCount === "number" ? (
                  <span className="text-[11px] tabular-nums opacity-70">
                    {tag.postCount}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground/70">—</p>
        )}
      </section>
    </div>
  );
}

/**
 * The hero introduction on the home page: the title, the description and the
 * author chip with the social links, laid over the lower part of the banner.
 */
function HeroIntroduction() {
  const { siteConfig } = useRouteContext({ from: "__root__" });
  const avatar =
    siteConfig.theme?.flare?.avatar || siteConfig.theme?.fuwari?.avatar || "";
  const socialLinks = siteConfig.social.filter((link: SocialLink) =>
    Boolean(link.url),
  );

  return (
    <div className="max-w-3xl flare-enter">
      <h1 className="text-[2.35rem] font-extrabold leading-[1.04] tracking-tight text-white drop-shadow-[0_6px_28px_rgba(0,0,0,0.4)] sm:text-5xl md:text-6xl lg:text-[4.25rem]">
        {siteConfig.title}
      </h1>
      {siteConfig.description || siteConfig.tagline ? (
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/90 drop-shadow-[0_2px_14px_rgba(0,0,0,0.35)] md:mt-5 md:text-lg md:leading-8">
          {siteConfig.description || siteConfig.tagline}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3 md:mt-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-inset ring-white/25 backdrop-blur-md">
          {avatar ? (
            <img
              src={avatar}
              alt=""
              className="h-7 w-7 rounded-full border border-white/35 object-cover"
            />
          ) : null}
          <span className="drop-shadow-sm">
            {siteConfig.author || siteConfig.title}
          </span>
        </span>

        {socialLinks.slice(0, 6).map((link: SocialLink, i: number) => {
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
              aria-label={label}
              title={label}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/85 ring-1 ring-inset ring-white/25 backdrop-blur-md transition-colors hover:bg-white/15 hover:text-white"
            >
              {Icon ? (
                <Icon size={16} strokeWidth={1.75} />
              ) : link.icon ? (
                <img src={link.icon} alt={label} className="h-4 w-4" />
              ) : (
                <UserRound size={15} />
              )}
            </a>
          );
        })}
      </div>

      <button
        type="button"
        className="mt-8 inline-flex h-10 w-10 items-center justify-center rounded-full text-white ring-1 ring-inset ring-white/30 backdrop-blur-md transition hover:bg-white/15"
        aria-label={m.common_open_menu?.() ?? "Scroll to content"}
        onClick={() =>
          window.scrollTo({
            top: Math.max(
              0,
              window.innerHeight * (BANNER_HEIGHT_HOME / 100) - 88,
            ),
            behavior: "smooth",
          })
        }
      >
        <ArrowDown size={18} />
      </button>
    </div>
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

  const showWidgets = !focused && !isPost;
  const isReadingPage = isPost || pathname.startsWith("/friend-links/submit");
  const pageInsetClass = useMemo(
    () =>
      cn(
        "mx-auto w-full px-5 md:px-6",
        isReadingPage
          ? "max-w-[min(var(--flare-reading-width),calc(100%-2rem))] md:max-w-[var(--flare-reading-width)]"
          : "max-w-[var(--flare-page-width)]",
      ),
    [isReadingPage],
  );

  const bodyOverlap = isHome ? "3.5rem" : "2.5rem";

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

      <div className="fixed inset-x-0 top-0 z-50 pointer-events-none">
        <div
          className={cn("pointer-events-auto", pageInsetClass, "pt-2 md:pt-3")}
        >
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
        style={{ height: `${bannerHeightVh}svh` }}
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
          <div className="h-full w-full bg-[linear-gradient(180deg,hsl(222_24%_32%),hsl(222_28%_18%))]" />
        )}
        <div className="flare-banner-overlay" />

        {isHome ? (
          <div className={cn("flare-hero", pageInsetClass)}>
            <HeroIntroduction />
          </div>
        ) : null}
      </section>

      <div
        className={cn("flare-body", pageInsetClass, "pb-10 md:pb-14")}
        style={{ marginTop: `calc(${bannerHeightVh}svh - ${bodyOverlap})` }}
      >
        <div className="flare-layout">
          {isHome && showWidgets ? <SidebarWidgets place="before" /> : null}

          <main className="flare-main" data-shell-region="main">
            {children}
          </main>

          {!isHome && showWidgets ? <SidebarWidgets place="after" /> : null}
        </div>

        <div className="mt-8 md:mt-10" data-shell-region="footer">
          <Footer navOptions={navOptions} />
        </div>
      </div>
    </div>
  );
}
