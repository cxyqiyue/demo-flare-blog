import { Link, useLocation, useRouteContext } from "@tanstack/react-router";
import { LogOut, Menu, Search, UserIcon, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import type { NavOption, UserInfo } from "@/features/theme/contract/layouts";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { LanguageSwitcher } from "./language-switcher";

interface NavbarProps {
  navOptions: Array<NavOption>;
  isLoading?: boolean;
  user?: UserInfo;
  logout: () => Promise<void>;
  bannerHeightVh: number;
}

export function Navbar({
  navOptions,
  user,
  isLoading,
  logout,
  bannerHeightVh,
}: NavbarProps) {
  const { siteConfig } = useRouteContext({ from: "__root__" });
  const pathname = useLocation({ select: (l) => l.pathname });
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => {
      // Condense before the content reaches the bar, so the links never sit
      // white-on-white over the first panel.
      const threshold = Math.max(
        12,
        window.innerHeight * (bannerHeightVh / 100) - 168,
      );
      setScrolled(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [bannerHeightVh]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const wide = () => {
      if (window.innerWidth >= 1200) setOpen(false);
    };
    window.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", wide);
    return () => {
      window.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", wide);
    };
  }, [open]);

  const brand = useMemo(
    () => siteConfig.title || siteConfig.theme?.default?.navBarName || "Blog",
    [siteConfig],
  );
  const avatar =
    siteConfig.theme?.flare?.avatar || siteConfig.theme?.fuwari?.avatar || "";

  const onBanner = !scrolled;

  const iconButton = cn(
    "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
    onBanner
      ? "text-white/85 hover:bg-white/15 hover:text-white"
      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
  );

  return (
    <header
      ref={headerRef}
      className="flare-nav mx-auto transition-[max-width] duration-300 motion-reduce:transition-none"
      style={{ maxWidth: scrolled ? "68rem" : "100%" }}
      data-on-banner={onBanner ? "true" : "false"}
    >
      <div
        className={cn(
          "flex w-full items-center justify-between gap-2 px-2 py-1.5 transition-all duration-300 md:px-3",
          onBanner
            ? "border border-transparent bg-transparent"
            : "flare-nav-plate border-border/70",
          "rounded-full",
        )}
      >
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2.5 rounded-full px-2 py-1"
        >
          {avatar ? (
            <img
              src={avatar}
              alt=""
              width={28}
              height={28}
              className={cn(
                "h-7 w-7 shrink-0 rounded-full object-cover ring-1",
                onBanner ? "ring-white/35" : "ring-border/70",
              )}
            />
          ) : null}
          <span
            className={cn(
              "block truncate text-[15px] font-bold tracking-tight transition-colors md:text-base",
              onBanner ? "text-white drop-shadow-sm" : "text-foreground",
            )}
          >
            {brand}
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 min-[1200px]:flex"
          aria-label={m.main_navigation()}
        >
          {navOptions.map((option) => (
            <Link
              key={option.id}
              to={option.to}
              activeOptions={{ exact: option.to === "/" }}
              className="flare-nav-link"
              activeProps={{ "data-status": "active" }}
            >
              <span className="truncate">{option.label}</span>
            </Link>
          ))}
        </nav>

        <div
          className={cn(
            "flare-nav-controls flex shrink-0 items-center gap-0.5",
          )}
        >
          <Link to="/search" className={iconButton} aria-label={m.nav_search()}>
            <Search size={17} strokeWidth={1.9} />
          </Link>
          <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center" />
          <LanguageSwitcher className="h-9 w-9" />

          <div className="hidden items-center pl-1 md:flex">
            {isLoading ? (
              <Skeleton className="h-8 w-8 rounded-full" />
            ) : user ? (
              <Link
                to="/profile"
                className={cn(
                  "h-8 w-8 overflow-hidden rounded-full ring-1 transition",
                  onBanner
                    ? "ring-white/40 hover:ring-white/70"
                    : "ring-border/60 hover:ring-border",
                )}
                title={user.name}
                aria-label={m.profile_title()}
              >
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className={cn(
                      "flex h-full w-full items-center justify-center",
                      onBanner
                        ? "bg-white/15 text-white"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <UserIcon size={14} />
                  </div>
                )}
              </Link>
            ) : (
              <Link
                to="/login"
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  onBanner
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-foreground text-background hover:opacity-90",
                )}
              >
                {m.nav_login()}
              </Link>
            )}
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            className={cn(iconButton, "min-[1200px]:hidden")}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? m.common_close() : m.common_open_menu()}
            aria-expanded={open}
            aria-controls="flare-navigation-menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="flare-navigation-menu"
          className="flare-nav-plate mt-2 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border/70 min-[1200px]:hidden"
        >
          <nav className="flex flex-col p-2">
            {navOptions.map((option) => (
              <Link
                key={option.id}
                to={option.to}
                activeOptions={{ exact: option.to === "/" }}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/85 transition-colors hover:bg-muted/60 hover:text-foreground"
                activeProps={{ className: "bg-muted/70 text-foreground" }}
              >
                {option.label}
              </Link>
            ))}
            <div className="my-1 h-px bg-border/60" />
            {isLoading ? (
              <div className="px-3 py-2">
                <Skeleton className="h-8 w-24" />
              </div>
            ) : user ? (
              <>
                <Link
                  to="/profile"
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-foreground/85 transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <UserIcon size={16} />
                  {m.profile_title()}
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut size={16} />
                  {m.profile_logout()}
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-xl px-3 py-2.5 text-sm text-foreground/85 transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                {m.nav_login()}
              </Link>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
