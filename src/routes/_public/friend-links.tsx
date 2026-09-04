import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import theme from "@theme";
import {
  approvedFriendLinksQuery,
  friendLinksConfigQuery,
} from "@/features/friend-links/queries";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_public/friend-links")({
  component: FriendLinksPage,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(approvedFriendLinksQuery());
    await context.queryClient.ensureQueryData(friendLinksConfigQuery());

    return {
      title: m.friend_links_title(),
      description: m.friend_links_desc(),
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
  pendingComponent: theme.FriendLinksPageSkeleton,
});

function FriendLinksPage() {
  const { data: links } = useSuspenseQuery(approvedFriendLinksQuery());
  const { data: config } = useSuspenseQuery(friendLinksConfigQuery());

  return (
    <theme.FriendLinksPage
      links={links}
      siteInfo={config?.siteInfo ?? {}}
      applyRules={(config?.applyRules ?? [])
        .map((rule) => ({ id: rule.id, content: rule.content ?? "" }))
        .filter((rule) => rule.content.trim() !== "")}
    />
  );
}
