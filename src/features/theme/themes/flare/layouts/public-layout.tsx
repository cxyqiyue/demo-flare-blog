import { useLocation, useRouteContext } from "@tanstack/react-router";
import type { PublicLayoutProps } from "@/features/theme/contract/layouts";
import { cn } from "@/lib/utils";
import { BackToTop } from "../components/back-to-top";
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
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isPost = pathname.startsWith("/post/");
  const focused = isFocusedPath(pathname);
  const bannerHeightVh = isAuthPage
    ? 12
    : isHome
      ? BANNER_HEIGHT_HOME
      : focused
        ? BANNER_HEIGHT_FOCUSED
        : BANNER_HEIGHT_PAGE;
  const bannerImage =
    siteConfig.theme?.flare?.homeBg || siteConfig.theme?.fuwari?.homeBg || "";

  const showWidgets = !focused && !pathname.startsWith("/navigation");
  const isReadingPage =
    isPost ||
    pathname === "/about" ||
    pathname.startsWith("/submit-friend-link");
  const pageInsetClass =
    "mx-auto w-full max-w-[var(--flare-page-width)] px-4 md:px-6";

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
        style={{
          marginTop: isAuthPage
            ? "calc(12svh + 3rem)"
            : `calc(${bannerHeightVh}svh - ${bodyOverlap})`,
        }}
      >
        <div
          className="flare-layout"
          data-sidebar={false}
          data-reading={isReadingPage}
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
              <LatestMoments />
            </div>
          ) : showWidgets ? (
            <div className="flare-inner-after">
              <IndexWidgets />
            </div>
          ) : null}
        </div>

        <BackToTop />
        <div className="relative z-45 mt-8 md:mt-10" data-shell-region="footer">
          <Footer navOptions={navOptions} />
        </div>
      </div>
    </div>
  );
}
