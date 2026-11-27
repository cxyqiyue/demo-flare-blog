import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BookOpenCheck,
  Compass,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  LogOut,
  Megaphone,
  MessageSquare,
  Settings,
  Tag,
  User,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/common/theme-toggle";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { sessionQuery } from "@/features/auth/queries";
import type { EnrichedSessionUser } from "@/features/auth/service/auth.service";
import { isFlare, isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { FileRoutesByTo } from "@/routeTree.gen";

interface NavItem {
  path: keyof FileRoutesByTo;
  icon: React.ElementType;
  label: string;
  exact: boolean;
  /** 仅超级管理员可见的后台模块；普通管理员在后台只保留文章管理与导航管理 */
  superAdminOnly?: boolean;
}

export function SideBar({
  isMobileSidebarOpen,
  closeMobileSidebar,
}: {
  isMobileSidebarOpen: boolean;
  closeMobileSidebar: () => void;
}) {
  const { logout } = useLogout({ redirectTo: "/login", admin: true });
  const { data: session } = useQuery(sessionQuery);
  const user = session?.user;

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const navItems = [
    {
      path: "/admin",
      icon: LayoutDashboard,
      label: m.admin_sidebar_dashboard(),
      exact: true,
    },
    {
      path: "/admin/posts",
      icon: FileText,
      label: m.admin_sidebar_posts(),
      exact: false,
    },
    {
      path: "/admin/tags",
      icon: Tag,
      label: m.admin_sidebar_tags(),
      exact: false,
      superAdminOnly: true,
    },
    {
      path: "/admin/skills",
      icon: BookOpenCheck,
      label: m.admin_sidebar_skills(),
      exact: false,
      superAdminOnly: true,
    },
    {
      path: "/admin/media",
      icon: ImageIcon,
      label: m.admin_sidebar_media(),
      exact: false,
      superAdminOnly: true,
    },
    {
      path: "/admin/comments",
      icon: MessageSquare,
      label: m.admin_sidebar_comments(),
      exact: false,
      superAdminOnly: true,
    },
    {
      path: "/admin/users",
      icon: Users,
      label: m.admin_sidebar_users(),
      exact: false,
      superAdminOnly: true,
    },
    {
      path: "/admin/friend-links",
      icon: Link2,
      label: m.admin_sidebar_friend_links(),
      exact: false,
      superAdminOnly: true,
    },
    {
      path: "/admin/navigation",
      icon: Compass,
      label: m.admin_sidebar_navigation(),
      exact: false,
    },
    {
      path: "/admin/announcements",
      icon: Megaphone,
      label: m.admin_sidebar_announcements(),
      exact: false,
      superAdminOnly: true,
    },
  ] satisfies Array<NavItem>;

  // 普通管理员在后台只保留：仪表盘、文章管理、导航管理
  const isSuper = user?.isSuperAdmin === true;
  const visibleNavItems = navItems.filter(
    (item) => isSuper || !item.superAdminOnly,
  );

  if (isFuwari) {
    return (
      <FuwariSidebar
        visibleNavItems={visibleNavItems}
        isMobileSidebarOpen={isMobileSidebarOpen}
        closeMobileSidebar={closeMobileSidebar}
        user={user}
        onSignOut={handleSignOutClick}
        onConfirmSignOut={handleConfirmSignOut}
      />
    );
  }

  if (isFlare) {
    return (
      <FlareSidebar
        visibleNavItems={visibleNavItems}
        isMobileSidebarOpen={isMobileSidebarOpen}
        closeMobileSidebar={closeMobileSidebar}
        user={user}
        onSignOut={handleSignOutClick}
        onConfirmSignOut={handleConfirmSignOut}
      />
    );
  }

  return (
    <>
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-60 lg:hidden backdrop-blur-sm animate-in fade-in duration-300"
          onClick={closeMobileSidebar}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-70 w-72 lg:w-64 border-r border-border/50 flex flex-col bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 transform transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          isMobileSidebarOpen
            ? "translate-x-0 shadow-2xl"
            : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="h-16 md:h-18 flex items-center justify-between px-4 md:px-5 shrink-0 border-b border-border/40">
          <Link to="/admin" className="flex items-center gap-2.5 group min-w-0">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-xs font-semibold">
              A
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight truncate">
                Admin
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                Management
              </div>
            </div>
          </Link>
          <button
            onClick={closeMobileSidebar}
            className="lg:hidden inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60"
            aria-label={m.admin_sidebar_close_navigation()}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {visibleNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={closeMobileSidebar}
              activeOptions={{ exact: item.exact, includeSearch: false }}
              className="block"
            >
              {({ isActive }) => (
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors border",
                    isActive
                      ? "bg-foreground text-background border-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border-transparent",
                  )}
                >
                  <item.icon
                    size={16}
                    strokeWidth={1.75}
                    className="shrink-0"
                  />
                  <span className="truncate font-medium">{item.label}</span>
                </div>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-border/40 shrink-0 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <span className="text-xs text-muted-foreground font-medium">
              {m.admin_sidebar_theme_mode()}
            </span>
            <ThemeToggle className="size-8" />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg border border-border/50 overflow-hidden flex items-center justify-center bg-background">
                {user?.image ? (
                  <img
                    src={user.image}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={14} className="text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">
                  {user?.name || m.admin_sidebar_admin_fallback()}
                </span>
                <span className="text-[11px] text-muted-foreground truncate">
                  {user?.role === "admin"
                    ? m.admin_sidebar_role_admin()
                    : m.admin_sidebar_role_user()}
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOutClick}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title={m.admin_sidebar_logout()}
            >
              <LogOut size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmSignOut}
        title={m.admin_sidebar_logout_title()}
        message={m.admin_sidebar_logout_message()}
        confirmLabel={m.admin_sidebar_logout_confirm()}
        isLoading={isLoggingOut}
      />
    </>
  );
}

interface FuwariSidebarProps {
  visibleNavItems: Array<NavItem>;
  isMobileSidebarOpen: boolean;
  closeMobileSidebar: () => void;
  user?: EnrichedSessionUser;
  onSignOut: () => void;
  onConfirmSignOut: () => Promise<void>;
}

/**
 * Fuwari admin sidebar — mirrors the public theme's "profile card +
 * menu list" column: a white rounded card with the admin identity up top
 * and a rounded link menu below it, floating on the tinted page canvas.
 */
function FuwariSidebar({
  visibleNavItems,
  isMobileSidebarOpen,
  closeMobileSidebar,
  user,
  onSignOut,
  onConfirmSignOut,
}: FuwariSidebarProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    await onConfirmSignOut();
  };

  const sidebarContent = (
    <div className="flex flex-col gap-4">
      {/* Admin identity card */}
      <div className="fuwari-card-base p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl shrink-0 bg-(--fuwari-btn-regular-bg) overflow-hidden flex items-center justify-center">
            {user?.image ? (
              <img
                src={user.image}
                alt={user.name || ""}
                className="w-full h-full object-cover"
              />
            ) : (
              <User size={20} className="fuwari-text-50" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-lg fuwari-text-90 truncate leading-snug">
              {user?.name || m.admin_sidebar_admin_fallback()}
            </p>
            <p className="text-sm fuwari-text-50">
              {user?.role === "admin"
                ? m.admin_sidebar_role_admin()
                : m.admin_sidebar_role_user()}
            </p>
          </div>
        </div>

        <div className="h-1 w-5 rounded-full mb-4 bg-(--fuwari-primary)" />

        <div className="flex items-center justify-between gap-2">
          <Link
            to="/admin/settings"
            onClick={closeMobileSidebar}
            className="fuwari-btn-regular rounded-lg h-10 w-10 active:scale-90 hover:text-(--fuwari-primary) transition-colors"
            title={m.admin_layout_settings()}
            aria-label={m.admin_layout_settings()}
          >
            <Settings size={18} strokeWidth={1.5} />
          </Link>
          <button
            onClick={onSignOut}
            className="fuwari-btn-regular rounded-lg h-10 px-4 flex items-center justify-center gap-2 text-sm font-medium fuwari-text-75 hover:text-(--fuwari-primary) active:scale-90 transition-all"
            title={m.admin_sidebar_logout()}
          >
            <LogOut size={16} strokeWidth={1.5} />
            <span>{m.admin_sidebar_logout()}</span>
          </button>
        </div>
      </div>

      {/* Admin menu card */}
      <div className="fuwari-card-base p-2">
        <nav className="flex flex-col gap-0.5">
          {visibleNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={closeMobileSidebar}
              activeOptions={{ exact: item.exact, includeSearch: false }}
              className="fuwari-expand-animation rounded-lg h-11 px-3 active:scale-95 transition-transform flex items-center gap-3 text-sm font-bold fuwari-text-75 hover:text-(--fuwari-primary)"
              activeProps={{
                className: "!text-[var(--fuwari-primary)]",
              }}
            >
              <item.icon size={18} strokeWidth={1.5} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isMobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-60 lg:hidden bg-black/30 backdrop-blur-sm animate-in fade-in duration-300 dark:bg-black/50"
            onClick={closeMobileSidebar}
          />
          <div className="fixed inset-y-0 left-0 z-70 lg:hidden w-80 max-w-[88vw] overflow-y-auto p-4 bg-(--fuwari-page-bg) transform transition-transform duration-300 ease-in-out custom-scrollbar translate-x-0">
            <div className="flex justify-end mb-2">
              <button
                onClick={closeMobileSidebar}
                className="fuwari-card-base h-10 w-10 flex items-center justify-center fuwari-text-75 hover:text-(--fuwari-primary) transition-colors"
                aria-label={m.admin_sidebar_close_navigation()}
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
            {sidebarContent}
          </div>
        </>
      )}

      {/* Desktop sticky column: full-height, pinned to the left edge,
          full-width rail like the default theme's fixed sidebar */}
      <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:z-70 shrink-0 flex-col gap-4 p-4 overflow-y-auto custom-scrollbar border-r border-border/30 bg-(--fuwari-card-bg) fuwari-onload-animation">
        {sidebarContent}
      </aside>

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
        title={m.admin_sidebar_logout_title()}
        message={m.admin_sidebar_logout_message()}
        confirmLabel={m.admin_sidebar_logout_confirm()}
        isLoading={isLoggingOut}
      />
    </>
  );
}

/**
 * Flare admin sidebar — the workbench rail: the site's mark, the menu as a
 * list of quiet rows where only the current page sits on a raised white pill,
 * and the account at the foot. It sits directly on the tinted canvas, as in
 * the reference admin.
 */
function FlareSidebar({
  visibleNavItems,
  isMobileSidebarOpen,
  closeMobileSidebar,
  user,
  onConfirmSignOut,
}: FuwariSidebarProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;
    if (!isMobileSidebarOpen) {
      dialog.close();
      return;
    }
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    const wide = () => {
      if (window.innerWidth >= 1024) closeMobileSidebar();
    };
    window.addEventListener("resize", wide);
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      window.removeEventListener("resize", wide);
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [isMobileSidebarOpen, closeMobileSidebar]);

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onConfirmSignOut();
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const sidebarContent = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 items-center justify-between gap-2 px-1">
        <Link
          to="/admin"
          onClick={closeMobileSidebar}
          className="flex min-w-0 items-center gap-2.5 rounded-[0.7rem] py-1"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[0.55rem] bg-foreground text-[11px] font-semibold text-background">
            A
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
              Admin
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              Management
            </span>
          </span>
        </Link>
        <button
          onClick={closeMobileSidebar}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/[0.045] hover:text-foreground lg:hidden dark:hover:bg-white/[0.06]"
          aria-label={m.admin_sidebar_close_navigation()}
        >
          <X size={17} strokeWidth={1.75} />
        </button>
      </div>

      <nav className="custom-scrollbar mt-3 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-2">
        {visibleNavItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={closeMobileSidebar}
            activeOptions={{ exact: item.exact, includeSearch: false }}
            className="flex h-9 items-center gap-2.5 rounded-[0.7rem] px-2.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-black/[0.045] hover:text-foreground dark:hover:bg-white/[0.06]"
            activeProps={{
              className:
                "bg-(--flare-surface) text-foreground shadow-[0_1px_2px_rgb(15_23_42/0.06)] ring-1 ring-border/70 hover:bg-(--flare-surface) hover:text-foreground",
            }}
          >
            <item.icon size={16} strokeWidth={1.75} className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="space-y-1 border-t border-border/60 pt-2">
        <div className="flex items-center justify-between rounded-[0.7rem] px-2 py-1">
          <span className="text-xs font-medium text-muted-foreground">
            {m.admin_sidebar_theme_mode()}
          </span>
          <ThemeToggle className="size-8" />
        </div>

        <div className="flex items-center gap-2.5 rounded-[0.7rem] px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.09]">
            {user?.image ? (
              <img
                src={user.image}
                alt={user.name || ""}
                className="h-full w-full object-cover"
              />
            ) : (
              <User size={14} className="text-muted-foreground" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-[13.5px] font-medium text-foreground">
              {user?.name || m.admin_sidebar_admin_fallback()}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {user?.role === "admin"
                ? m.admin_sidebar_role_admin()
                : m.admin_sidebar_role_user()}
            </span>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title={m.admin_sidebar_logout()}
          >
            <LogOut size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <dialog
        ref={drawerRef}
        aria-label={m.admin_sidebar_close_navigation()}
        onCancel={closeMobileSidebar}
        onClose={closeMobileSidebar}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMobileSidebar();
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0 text-foreground backdrop:bg-black/35 backdrop:backdrop-blur-sm lg:hidden"
      >
        <div className="flare-admin-drawer flex h-full w-[min(18rem,86vw)] flex-col bg-(--flare-ground) px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
          {sidebarContent}
        </div>
      </dialog>

      <aside className="hidden shrink-0 flex-col px-3 py-4 lg:sticky lg:top-0 lg:z-30 lg:flex lg:h-screen lg:w-64">
        {sidebarContent}
      </aside>

      <ConfirmationModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
        title={m.admin_sidebar_logout_title()}
        message={m.admin_sidebar_logout_message()}
        confirmLabel={m.admin_sidebar_logout_confirm()}
        isLoading={isLoggingOut}
      />
    </>
  );
}
