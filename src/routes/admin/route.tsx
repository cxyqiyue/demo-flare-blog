import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { ArrowUpRight, Menu, Settings } from "lucide-react";
import { useState } from "react";
import { SideBar } from "@/components/admin/side-bar";
import { Breadcrumbs } from "@/components/breadcrumbs";
import Toaster from "@/components/ui/toaster";
import { sessionQuery } from "@/features/auth/queries";
import { CACHE_CONTROL } from "@/lib/constants";
import { isFuwari } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";
// 管理后台跟随当前激活主题（THEME 变量），使用当前主题的样式
import "@theme/styles/index.css";
import "@/styles/admin.css";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery);

    if (!session) {
      throw redirect({ to: "/login" });
    }
    if (session.user.role !== "admin" && !session.user.isSuperAdmin) {
      throw redirect({ to: "/" });
    }

    return { session };
  },
  component: AdminLayout,
  loader: () => ({
    title: m.admin_layout_title(),
  }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title,
      },
    ],
  }),
  headers: () => {
    return CACHE_CONTROL.private;
  },
});

function AdminLayout() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const closeMobileSidebar = () => setIsMobileSidebarOpen(false);

if (isFuwari) {
    return (
      <div className="admin-layout fuwari-admin relative h-dvh overflow-hidden bg-(--fuwari-page-bg) flex font-sans">
        <SideBar
          isMobileSidebarOpen={isMobileSidebarOpen}
          closeMobileSidebar={closeMobileSidebar}
        />

        {/* Main Content Area — same frame skeleton as default theme */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Top Header: solid bar (not a card), matches default's frame */}
          <header className="h-20 border-b border-border/30 bg-(--fuwari-card-bg) flex items-center justify-between gap-4 px-4 sm:px-6 md:px-10 sticky top-0 z-30 shrink-0 overflow-x-auto overscroll-x-contain">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden fuwari-btn-regular rounded-lg h-10 w-10 shrink-0 active:scale-90 hover:text-(--fuwari-primary) transition-colors"
                aria-label={m.admin_layout_open_navigation()}
              >
                <Menu size={18} strokeWidth={1.5} />
              </button>
              <Breadcrumbs />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Link
                to="/admin/settings"
                className="fuwari-btn-regular rounded-lg h-10 w-10 active:scale-90 hover:text-(--fuwari-primary) transition-colors"
                title={m.admin_layout_settings()}
                aria-label={m.admin_layout_settings()}
              >
                <Settings size={18} strokeWidth={1.5} />
              </Link>
              <Link
                to="/"
                className="fuwari-btn-regular rounded-lg h-10 pl-3 pr-4 flex items-center gap-2 text-sm font-medium fuwari-text-75 hover:text-(--fuwari-primary) transition-colors"
              >
                <ArrowUpRight size={16} strokeWidth={1.5} />
                <span>{m.admin_layout_back_to_site()}</span>
              </Link>
            </div>
          </header>

          {/* Content Scroll: inner scrolling region, spacious padding */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6 md:p-12 custom-scrollbar">
            <div className="mx-auto max-w-7xl flex flex-col gap-5 lg:gap-6 fuwari-onload-animation">
              <Outlet />
            </div>
          </div>
        </main>
        <Toaster />
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden bg-background text-foreground flex relative font-sans admin-layout">
      <SideBar
        isMobileSidebarOpen={isMobileSidebarOpen}
        closeMobileSidebar={closeMobileSidebar}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top Header */}
        <header className="h-20 border-b border-border/30 bg-background flex items-center justify-between gap-4 px-4 sm:px-6 md:px-10 sticky top-0 z-30 shrink-0 overflow-x-auto overscroll-x-contain">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-muted/50 rounded-sm transition-colors text-foreground"
              aria-label={m.admin_layout_open_navigation()}
            >
              <Menu size={20} strokeWidth={1.5} />
            </button>
            <Breadcrumbs />
          </div>

          <div className="flex items-center gap-6">
            <Link
              to="/admin/settings"
              className="group p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors"
              title={m.admin_layout_settings()}
            >
              <Settings
                size={18}
                strokeWidth={1.5}
                className="group-hover:rotate-45 transition-transform duration-500 ease-in-out"
              />
            </Link>
            <div className="h-4 w-px bg-border/40" />
            <Link
              to="/"
              className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-mono font-medium text-muted-foreground hover:text-foreground transition-colors group"
            >
              <span>{m.admin_layout_back_to_site()}</span>
              <ArrowUpRight
                size={10}
                strokeWidth={1.5}
                className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
              />
            </Link>
          </div>
        </header>

        {/* Content Scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 md:p-12 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
      <Toaster />
    </div>
  );
}
