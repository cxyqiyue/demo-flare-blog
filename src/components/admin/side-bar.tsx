import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
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
import { useState } from "react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/common/theme-toggle";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { AUTH_KEYS, sessionQuery } from "@/features/auth/queries";
import type { EnrichedSessionUser } from "@/features/auth/service/auth.service";
import { authClient } from "@/lib/auth/auth.client";
import { isFuwari } from "@/lib/theme-mode";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useQuery(sessionQuery);
  const user = session?.user;

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmSignOut = async () => {
    setIsLoggingOut(true);
    const { error } = await authClient.signOut();
    setIsLoggingOut(false);
    setShowLogoutConfirm(false);

    if (error) {
      toast.error(m.admin_sidebar_logout_failed(), {
        description: m.admin_sidebar_logout_failed_desc(),
      });
      return;
    }

    queryClient.removeQueries({ queryKey: AUTH_KEYS.session });

    toast.success(m.admin_sidebar_logout_success());
    navigate({ to: "/login" });
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

  return (
    <>
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 z-60 lg:hidden backdrop-blur-sm animate-in fade-in duration-500"
          onClick={closeMobileSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-70 w-72 lg:w-64 border-r border-border/30 flex flex-col bg-background transform transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          isMobileSidebarOpen
            ? "translate-x-0 shadow-2xl"
            : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Logo Area */}
        <div className="h-20 flex items-center justify-between px-6 shrink-0 border-b border-border/30">
          <Link to="/admin" className="flex items-center gap-3 group">
            <span className="font-serif font-black text-xl tracking-tighter group-hover:opacity-80 transition-opacity">
              [ Admin ]
            </span>
          </Link>
          <button
            onClick={closeMobileSidebar}
            className="lg:hidden p-2 text-muted-foreground hover:text-foreground"
            aria-label={m.admin_sidebar_close_navigation()}
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto custom-scrollbar">
          {visibleNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={closeMobileSidebar}
              activeOptions={{ exact: item.exact, includeSearch: false }}
              className="group flex flex-col"
            >
              {({ isActive }) => (
                <div
                  className={cn(
                    "flex items-center gap-4 px-4 py-3 text-[11px] font-mono transition-all border border-transparent",
                    isActive
                      ? "bg-foreground text-background border-foreground"
                      : "text-muted-foreground hover:text-foreground hover:border-border/30",
                  )}
                >
                  <item.icon size={14} strokeWidth={1.5} className="shrink-0" />
                  <div className="flex flex-col">
                    <span className="uppercase tracking-widest font-medium leading-none">
                      {isActive ? `> ${item.label}` : item.label}
                    </span>
                  </div>
                </div>
              )}
            </Link>
          ))}
        </nav>

        {/* User Profile / Logout */}
        <div className="p-6 border-t border-border/30 shrink-0 space-y-6">
          {/* Theme Toggle Area */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
              {m.admin_sidebar_theme_mode()}
            </span>
            <ThemeToggle className="size-8" />
          </div>

          {/* User Info */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 border border-border/30 flex items-center justify-center bg-muted/20">
                {user?.image ? (
                  <img
                    src={user.image}
                    alt={user.name}
                    className="w-full h-full object-cover opacity-80"
                  />
                ) : (
                  <User size={14} className="opacity-50" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-mono uppercase tracking-wider truncate max-w-25">
                  {user?.name || m.admin_sidebar_admin_fallback()}
                </span>
                <span className="text-[8px] text-muted-foreground font-mono">
                  {user?.role === "admin"
                    ? m.admin_sidebar_role_admin()
                    : m.admin_sidebar_role_user()}
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOutClick}
              className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors border border-transparent hover:border-destructive/30"
              title={m.admin_sidebar_logout()}
            >
              <LogOut size={14} strokeWidth={1.5} />
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
      <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:w-64 shrink-0 flex-col gap-4 p-4 fuwari-onload-animation">
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
