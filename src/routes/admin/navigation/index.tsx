import { createFileRoute } from "@tanstack/react-router";
import { NavigationAdminPage } from "@/features/navigation/components/admin/navigation-admin-page";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/admin/navigation/")({
  ssr: false,
  component: NavigationAdminPage,
  loader: () => {
    return {
      title: m.navigation_admin_title(),
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title,
      },
    ],
  }),
});
