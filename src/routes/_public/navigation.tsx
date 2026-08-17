import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import theme from "@theme";
import type { NavigationPublicData } from "@/features/navigation/navigation.schema";
import {
  navigationAdminDataQuery,
  navigationPublicDataQuery,
} from "@/features/navigation/queries";
import { authClient } from "@/lib/auth/auth.client";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_public/navigation")({
  component: NavigationPage,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(navigationPublicDataQuery());

    return {
      title: m.navigation_title(),
      description: m.navigation_desc(),
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title,
      },
      {
        name: "description",
        content: loaderData?.description,
      },
    ],
  }),
  pendingComponent: theme.NavigationPageSkeleton,
});

function NavigationPage() {
  const { data: publicData } = useSuspenseQuery(navigationPublicDataQuery());
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "admin";

  // 书签数据仅管理员可访问，未登录/普通用户不会请求
  const adminQuery = useQuery({
    ...navigationAdminDataQuery(),
    enabled: isAdmin,
  });
  const adminData = adminQuery.data;

  const data: NavigationPublicData =
    isAdmin && adminData
      ? adminData
      : { engines: publicData.engines, folders: [], bookmarks: [] };

  return (
    <theme.NavigationPage
      data={data}
      isAdmin={isAdmin}
      showBookmarks={isAdmin && !!adminData}
    />
  );
}
