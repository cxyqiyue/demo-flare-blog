import { useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import theme from "@theme";
import { useEffect } from "react";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { FullSiteGateOverlay } from "@/features/challenge/components/full-site-gate-overlay";
import { fullSiteLockedQuery } from "@/features/challenge/queries";
import { getThemePreloadImages } from "@/features/theme/site-config.helpers";
import { authClient } from "@/lib/auth/auth.client";
import { CACHE_CONTROL } from "@/lib/constants";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_public")({
  beforeLoad: async ({ context, location }) => {
    // 全站人机验证：服务端判定是否锁定（读通行证 cookie + 配置）。
    // /unsubscribe 为豁免页，始终不叠加遮罩。
    if (location.pathname === "/unsubscribe") {
      return { fullSiteLocked: false };
    }
    const locked = await context.queryClient.ensureQueryData({
      ...fullSiteLockedQuery,
      // Revalidate expired data in the background. Existing state is enough to
      // render this transition without making every navigation wait on D1.
      revalidateIfStale: true,
    });
    return { fullSiteLocked: locked && location.pathname !== "/unsubscribe" };
  },
  loader: ({ context }) => ({
    preloadImages: getThemePreloadImages(context.siteConfig),
    fullSiteLocked: context.fullSiteLocked ?? false,
  }),
  component: PublicLayout,
  headers: () => {
    return CACHE_CONTROL.private;
  },
  head: ({ loaderData }) => ({
    links: (loaderData?.preloadImages ?? []).map((href) => ({
      rel: "preload" as const,
      as: "image",
      href,
    })),
  }),
});

function PublicLayout() {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const { logout } = useLogout();
  const loaderData = Route.useLoaderData();
  const { data: lockedStatus } = useQuery({
    ...fullSiteLockedQuery,
    enabled: pathname !== "/unsubscribe",
  });
  const fullSiteLocked =
    pathname !== "/unsubscribe" &&
    (lockedStatus ?? loaderData?.fullSiteLocked ?? false);

  const navOptions = [
    { label: m.nav_navigation(), to: "/navigation" as const, id: "navigation" },
    { label: m.nav_home(), to: "/" as const, id: "home" },
    { label: m.nav_posts(), to: "/posts" as const, id: "posts" },
    { label: m.nav_moments(), to: "/moments" as const, id: "moments" },
    {
      label: m.nav_friend_links(),
      to: "/friend-links" as const,
      id: "friend-links",
    },
    { label: m.nav_about(), to: "/about" as const, id: "about" },
  ];

  // Global shortcut: Cmd/Ctrl + K to navigate to search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isToggle = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isToggle) {
        e.preventDefault();
        navigate({ to: "/search" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <>
      <theme.PublicLayout
        navOptions={navOptions}
        user={session?.user}
        isSessionLoading={isSessionPending}
        logout={logout}
      >
        <Outlet />
      </theme.PublicLayout>
      {fullSiteLocked && <FullSiteGateOverlay />}
      <theme.Toaster />
    </>
  );
}
