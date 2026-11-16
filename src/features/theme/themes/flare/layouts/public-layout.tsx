import { useLocation, useRouteContext } from "@tanstack/react-router";
import { ArrowDown } from "lucide-react";
import { useMemo } from "react";
import type { PublicLayoutProps } from "@/features/theme/contract/layouts";
import { cn } from "@/lib/utils";
import { Footer } from "./footer";
import { Navbar } from "./navbar";

const BANNER_HEIGHT_HOME = 78;
const BANNER_HEIGHT_PAGE = 30;
const BANNER_HEIGHT_FOCUSED = 22;
const MAIN_OVERLAP_REM = 4;
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
  const bannerHeightVh = isHome
    ? BANNER_HEIGHT_HOME
    : focused
      ? BANNER_HEIGHT_FOCUSED
      : BANNER_HEIGHT_PAGE;
  const bannerImage =
    siteConfig.theme?.flare?.homeBg ||
    siteConfig.theme?.fuwari?.homeBg ||
    "";
  const avatar =
    siteConfig.theme?.flare?.avatar || siteConfig.theme?.fuwari?.avatar || "";

  const contentWrapClass = useMemo(
    () =>
      cn(
        "flare-content-grid relative mx-auto w-full px-4 md:px-6 pb-12 grid gap-6",
        focused || isPost
          ? "grid-cols-1 max-w-4xl"
          : "grid-cols-1 lg:grid-cols-[minmax(0,1fr)] max-w-[var(--flare-page-width,1120px)]",
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
        <div className="pointer-events-auto mx-auto w-full max-w-[var(--flare-page-width,1120px)] px-0 md:px-4">
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
        className="absolute left-0 right-0 top-0 z-10 overflow-hidden transition-[height] duration-500 ease-out"
        style={{ height: `${bannerHeightVh}vh` }}
      >
        {bannerImage ? (
          <img
            src={bannerImage}
            alt=""
            className={cn(
              "h-full w-full object-cover object-center scale-[1.02] transition-opacity duration-500",
              isHome ? "opacity-100" : "opacity-95",
            )}
            fetchPriority={isHome ? "high" : "auto"}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-muted/70 via-muted/40 to-background" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/20 to-background/10 dark:from-black/50 dark:via-black/30 dark:to-background/5" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/75 to-transparent" />

        {isHome ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-[16%] z-20 mx-auto w-full max-w-[var(--flare-page-width,1120px)] px-6 md:px-10">
            <div className="max-w-3xl text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
              <h1 className="text-4xl font-semibold tracking-tight leading-[1.05] md:text-6xl">
                {siteConfig.title}
              </h1>
              {siteConfig.description ? (
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/90 md:text-lg md:leading-8">
                  {siteConfig.description}
                </p>
              ) : null}
              <div className="mt-6 flex items-center gap-3 text-sm text-white/90 md:text-base">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={siteConfig.author || siteConfig.title}
                    className="h-8 w-8 rounded-full border border-white/30 object-cover"
                  />
                ) : null}
                {siteConfig.author ? (
                  <span className="font-medium">{siteConfig.author}</span>
                ) : null}
              </div>
              <button
                type="button"
                className="pointer-events-auto mt-8 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
                aria-label="Scroll to content"
                onClick={() =>
                  window.scrollTo({
                    top: Math.max(
                      0,
                      window.innerHeight * (bannerHeightVh / 100) - 110,
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
          <div className="mt-2" data-shell-region="footer">
            <Footer navOptions={navOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
