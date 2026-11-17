import { useLocation, useRouteContext } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { useMemo } from "react";
import {
  resolveSocialHref,
  SOCIAL_PLATFORMS,
  type SocialLink,
} from "@/features/config/utils/social-platforms";
import type { PublicLayoutProps } from "@/features/theme/contract/layouts";
import { cn } from "@/lib/utils";
import { Footer } from "./footer";
import { IndexWidgets, LatestMoments } from "./index-widgets";
import { Navbar } from "./navbar";

const BANNER_HEIGHT_HOME = 78;
const BANNER_HEIGHT_PAGE = 44;
const BANNER_HEIGHT_FOCUSED = 24;

function isFocusedPath(pathname: string) {
  return (
    pathname.startsWith("/search") ||
    pathname.startsWith("/friend-links/submit") ||
    pathname.startsWith("/submit-friend-link") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/unsubscribe")
  );
}

/** The writer's identity is its own placement region. */
function ProfileWidget() {
  const { siteConfig } = useRouteContext({ from: "__root__" });

  const avatar =
    siteConfig.theme?.flare?.avatar || siteConfig.theme?.fuwari?.avatar || "";
  const socialLinks = siteConfig.social.filter((link: SocialLink) =>
    Boolean(link.url),
  );

  return (
    <aside className="flare-profile-widget" aria-label="作者资料">
      <section className="flare-surface flex flex-col gap-4 p-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          {avatar ? (
            <img
              src={avatar}
              alt={siteConfig.author || siteConfig.title}
              className="h-24 w-24 shrink-0 rounded-full border-4 border-background bg-muted/30 object-cover shadow-sm"
              width={96}
              height={96}
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-muted/40 text-muted-foreground">
              <UserRound size={20} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="break-words text-xl font-bold text-foreground">
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
          <div className="flex flex-wrap justify-center gap-2">
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

  const showWidgets = !focused && !pathname.startsWith("/navigation");
  const isReadingPage = pathname.startsWith("/submit-friend-link");
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

  const bodyOverlap = isHome ? "-1.5rem" : "2.5rem";

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
      </section>

      <div
        id="flare-content"
        className={cn("flare-body", pageInsetClass, "pb-10 md:pb-14")}
        style={{ marginTop: `calc(${bannerHeightVh}svh - ${bodyOverlap})` }}
      >
        <div
          className="flare-layout"
          data-sidebar={false}
          data-reading={isPost}
        >
          {isHome ? (
            <div className="flare-home-before">
              <IndexWidgets />
            </div>
          ) : null}
          <main className="flare-main" data-shell-region="main">
            {children}
          </main>

          {isHome ? (
            <div className="flare-home-after">
              <ProfileWidget />
              <LatestMoments />
            </div>
          ) : showWidgets ? (
            <div className="flare-inner-after">
              <ProfileWidget />
              <IndexWidgets />
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
