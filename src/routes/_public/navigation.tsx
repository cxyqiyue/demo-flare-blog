import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import theme from "@theme";
import { navigationPublicDataQuery } from "@/features/navigation/queries";
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
  const { data } = useSuspenseQuery(navigationPublicDataQuery());
  const { data: session } = authClient.useSession();

  return (
    <theme.NavigationPage
      data={data}
      isAdmin={session?.user.role === "admin"}
    />
  );
}
