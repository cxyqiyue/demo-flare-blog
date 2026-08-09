import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import theme from "@theme";
import { useState } from "react";
import { publicMomentsQuery } from "@/features/moments/queries";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_public/moments")({
  component: MomentsPage,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(publicMomentsQuery());

    return {
      title: m.moments_title(),
      description: m.moments_desc(),
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
  pendingComponent: theme.MomentsPageSkeleton,
});

const INITIAL_LIMIT = 10;

function MomentsPage() {
  const queryClient = useQueryClient();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data } = useQuery(
    publicMomentsQuery({ offset: 0, limit: INITIAL_LIMIT }),
  );

  const moments = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasMore = data?.hasNext ?? false;

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const next = await queryClient.ensureQueryData(
        publicMomentsQuery({ offset: moments.length, limit: INITIAL_LIMIT }),
      );
      queryClient.setQueryData(
        publicMomentsQuery({ offset: 0, limit: INITIAL_LIMIT }).queryKey,
        {
          items: [...moments, ...(next?.items ?? [])],
          total: next?.total ?? total,
          hasNext: next?.hasNext ?? false,
        },
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <theme.MomentsPage
      moments={moments}
      total={total}
      hasNext={hasMore}
      hasMore={hasMore}
      onLoadMore={handleLoadMore}
      isLoadingMore={isLoadingMore}
    />
  );
}
