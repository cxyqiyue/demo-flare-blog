import { useLocation, useRouteContext } from "@tanstack/react-router";
import { ArrowDown } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import type { PublicLayoutProps } from "@/features/theme/contract/layouts";
import { cn } from "@/lib/utils";
import { Footer } from "./footer";
import { Navbar } from "./navbar";

const BANNER_HEIGHT_HOME = 72;
const BANNER_HEIGHT_PAGE = 34;
const MAIN_OVERLAP_REM = 3.5;
const NAVBAR_HEIGHT_REM = 4.5;

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
  const bannerHeightVh = isHome ? BANNER_HEIGHT_HOME : BANNER_HEIGHT_PAGE;
  const bannerImage =
    siteConfig.theme?.flare?.homeBg ||
    siteConfig.theme?.fuwari?.homeBg ||
    "";

  const contentWrapClass = useMemo(
    () =>
      cn(
        "flare-content-grid relative mx-auto w-full px-4 md:px-6 pb-10 grid gap-6",
        focused || isPost
          ? "grid-cols-1 max-w-4xl"
          : "grid-cols-1 lg:grid-cols-[minmax(0,1fr)] max-w-[var(--flare-page-width,1100px)]",
      ),
    [focused, isPost],
  );

  return (
    <div
      className="flare-shell relative min-h-screen"
      data-flare-home={isHome ? "true" : "false"}
      data-flare-focused={focused ? "true" : "false"}
    >
      <div className="sticky top-0 z-50 pointer-events-none">
        <div className="pointer-events-auto mx-auto w-full max-w-[var(--flare-page-width,1100px)] px-0 md:px-4">
          <Navbar
            navOptions={navOptions}
            user={user}
            isLoading={isSessionLoading}
            logout={logout}
            bannerHeightVh={bannerHeightVh}
          />
        </div>
      </div>

      <div
        className="absolute left-0 right-0 top-0 z-10 overflow-hidden"
        style={{ height: `${bannerHeightVh}vh` }}
      >
        {bannerImage ? (
          <img
            src={bannerImage}
            alt=""
            className="h-full w-full object-cover object-center"
            fetchPriority={isHome ? "high" : "auto"}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-muted/60 via-muted/30 to-background" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-background/0 dark:from-black/40 dark:via-black/25" />
        {isHome ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-[18%] z-20 mx-auto w-full max-w-[var(--flare-page-width,1100px)] px-6 md:px-10">
            <div className="max-w-3xl text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.35)]">
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                {siteConfig.title}
              </h1>
              {siteConfig.description ? (
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/90 md:text-base">
                  {siteConfig.description}
                </p>
              ) : null}
              <div className="mt-5 flex items-center gap-3 text-sm text-white/90">
                {siteConfig.author ? <span>{siteConfig.author}</span> : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className="relative z-30"
        style={{
          marginTop: `calc(${bannerHeightVh}vh - ${MAIN_OVERLAP_REM}rem - ${NAVBAR_HEIGHT_REM}rem)`,
        }}
      >
        <div className={contentWrapClass}>
          <main className="min-w-0" data-shell-region="main">
            {children}
          </main>
          <div className="mt-4" data-shell-region="footer">
            <Footer navOptions={navOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
