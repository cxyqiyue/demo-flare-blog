import { Link, useLocation, useRouteContext } from "@tanstack/react-router";
import { LogOut, Menu, Search, UserIcon, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import type { NavOption, UserInfo } from "@/features/theme/contract/layouts";
import { m } from "@/paraglide/messages";
import { cn } from "@/lib/utils";
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

  useEffect(() => {
    const onScroll = () => {
      const threshold = Math.max(24, window.innerHeight * (bannerHeightVh / 100) - 160);
      setScrolled(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [bannerHeightVh]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const brand = useMemo(
    () => siteConfig.title || siteConfig.theme?.default?.navBarName || "Blog",
    [siteConfig],
  );

  return (
    <>
      <header
        className={cn(
          "mt-2 md:mt-3 flex items-center transition-all duration-300",
          "rounded-2xl md:rounded-full border",
          scrolled
            ? "bg-background/80 backdrop-blur-xl border-border/50 shadow-sm"
            : "bg-black/15 dark:bg-white/5 backdrop-blur-md border-white/20 shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
        )}
      >
        <div className="flex w-full items-center justify-between gap-2 px-3 py-2 md:px-4 md:py-2.5">
          <Link to="/" className="min-w-0 px-2 py-1">
            <span
              className={cn(
                "block truncate text-sm md:text-base font-semibold tracking-tight",
                scrolled ? "text-foreground" : "text-white",
              )}
            >
              {brand}
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navOptions.map((option) => (
              <Link
                key={option.id}
                to={option.to}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm transition-colors",
                  scrolled
                    ? "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    : "text-white/85 hover:text-white hover:bg-white/10",
                )}
                activeProps={{
                  className: scrolled
                    ? "!text-foreground !bg-muted/70"
                    : "!text-white !bg-white/15",
                }}
              >
                {option.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1 shrink-0">
            <div className={cn("flex items-center", scrolled ? "text-foreground" : "text-white")}>
              <ThemeToggle />
              <LanguageSwitcher
                className={cn(
                  "h-8 w-8",
                  scrolled ? "text-muted-foreground hover:text-foreground" : "text-white/85 hover:text-white",
                )}
              />
              <Link
                to="/search"
                className={cn(
                  "h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors",
                  scrolled ? "text-muted-foreground hover:text-foreground hover:bg-muted/50" : "text-white/85 hover:text-white hover:bg-white/10",
                )}
                aria-label={m.nav_search()}
              >
                <Search size={16} strokeWidth={1.75} />
              </Link>
            </div>

            <div className="hidden md:flex items-center pl-1">
              {isLoading ? (
                <Skeleton className="h-8 w-8 rounded-full" />
              ) : user ? (
                <Link
                  to="/profile"
                  className="h-8 w-8 rounded-full overflow-hidden ring-1 ring-white/30 hover:ring-white/60 transition"
                  title={user.name}
                >
                  {user.image ? (
                    <img src={user.image} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className={cn("h-full w-full flex items-center justify-center", scrolled ? "bg-muted text-muted-foreground" : "bg-white/15 text-white")}>
                      <UserIcon size={14} />
                    </div>
                  )}
                </Link>
              ) : (
                <Link
                  to="/login"
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    scrolled ? "bg-foreground text-background hover:opacity-90" : "bg-white text-black hover:bg-white/90",
                  )}
                >
                  {m.nav_login()}
                </Link>
              )}
            </div>

            <button
              type="button"
              className={cn(
                "lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                scrolled ? "text-foreground hover:bg-muted/60" : "text-white hover:bg-white/10",
              )}
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? m.common_close() : m.common_open_menu()}
              aria-expanded={open}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {open ? (
        <div className="mt-2 lg:hidden rounded-2xl border border-border/60 bg-background/90 backdrop-blur-xl shadow-sm overflow-hidden">
          <nav className="p-2 flex flex-col">
            {navOptions.map((option) => (
              <Link
                key={option.id}
                to={option.to}
                className="rounded-xl px-3 py-2.5 text-sm text-foreground/85 hover:bg-muted/60 hover:text-foreground transition-colors"
                activeProps={{ className: "bg-muted/70 text-foreground" }}
              >
                {option.label}
              </Link>
            ))}
            <div className="my-1 h-px bg-border/60" />
            {isLoading ? (
              <div className="px-3 py-2"><Skeleton className="h-8 w-24" /></div>
            ) : user ? (
              <>
                <Link
                  to="/profile"
                  className="rounded-xl px-3 py-2.5 text-sm text-foreground/85 hover:bg-muted/60 hover:text-foreground transition-colors flex items-center gap-2"
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
                  className="rounded-xl px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2 text-left"
                >
                  <LogOut size={16} />
                  {m.profile_logout()}
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-xl px-3 py-2.5 text-sm text-foreground/85 hover:bg-muted/60 hover:text-foreground transition-colors"
              >
                {m.nav_login()}
              </Link>
            )}
          </nav>
        </div>
      ) : null}
    </>
  );
}
