import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import theme from "@theme";
import { z } from "zod";
import { siteDomainQuery } from "@/features/config/queries";
import { publicPostsPageQuery } from "@/features/posts/queries";
import { buildCanonicalUrl, canonicalLink } from "@/lib/seo";

const { postsPerPage } = theme.config.home;

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/_public/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ context, deps }) => {
    const offset = (deps.page - 1) * postsPerPage;
    const [, domain] = await Promise.all([
      context.queryClient.ensureQueryData(
        publicPostsPageQuery({ offset, limit: postsPerPage }),
      ),
      context.queryClient.ensureQueryData(siteDomainQuery),
    ]);

    return {
      canonicalHref: buildCanonicalUrl(domain, "/"),
    };
  },
  head: ({ loaderData }) => ({
    links: [canonicalLink(loaderData?.canonicalHref ?? "/")],
  }),
  pendingComponent: HomePageSkeleton,
  component: HomeRoute,
});

function HomeRoute() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { page } = Route.useSearch();
  const currentPage = page ?? 1;
  const offset = (currentPage - 1) * postsPerPage;

  const { data: pageData } = useSuspenseQuery(
    publicPostsPageQuery({ offset, limit: postsPerPage }),
  );

  const handlePageChange = (nextPage: number) => {
    navigate({
      search: { page: nextPage > 1 ? nextPage : undefined },
    });
  };

  return (
    <theme.HomePage
      posts={pageData.items}
      page={currentPage}
      pageSize={postsPerPage}
      total={pageData.total}
      hasPrevPage={pageData.hasPrevPage}
      hasNextPage={pageData.hasNextPage}
      onPageChange={handlePageChange}
    />
  );
}

function HomePageSkeleton() {
  return <theme.HomePageSkeleton />;
}
