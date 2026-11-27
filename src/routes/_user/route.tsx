import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import theme from "@theme";
import { useEffect } from "react";
import { ErrorPage } from "@/components/common/error-page";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { sessionQuery } from "@/features/auth/queries";
import { authClient } from "@/lib/auth/auth.client";
import { CACHE_CONTROL } from "@/lib/constants";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_user")({
  loader: async ({ context }) => {
    const session = await context.queryClient.fetchQuery(sessionQuery);
    return { session };
  },
  component: UserLayout,
  errorComponent: ({ error }) => <ErrorPage error={error} />,
  headers: () => {
    return CACHE_CONTROL.private;
  },
});

function UserLayout() {
  const { session } = Route.useLoaderData();
  const navigate = useNavigate();
  const { isPending: isSessionPending } = authClient.useSession();
  const { logout } = useLogout();

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
      <theme.UserLayout
        isAuthenticated={!!session?.user}
        navOptions={navOptions}
        user={session?.user}
        isSessionLoading={isSessionPending}
        logout={logout}
      >
        <Outlet />
      </theme.UserLayout>
      <theme.Toaster />
    </>
  );
}
