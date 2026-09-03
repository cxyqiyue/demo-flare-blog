import { createFileRoute } from "@tanstack/react-router";
import { TagManager } from "@/features/tags/components/tag-manager";
import { tagsWithCountAdminQueryOptions } from "@/features/tags/queries";
import { requireSuperAdminRoute } from "@/lib/auth/route-guards";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/admin/tags/")({
  ssr: "data-only",
  beforeLoad: requireSuperAdminRoute,
  component: TagManagerRoute,
  loader: async ({ context }) => {
    // Prefetch tags with count for a smooth load
    await context.queryClient.prefetchQuery(tagsWithCountAdminQueryOptions());
    return {
      title: m.tag_manager_title(),
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

function TagManagerRoute() {
  return <TagManager />;
}
