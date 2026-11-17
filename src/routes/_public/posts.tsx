import {
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import theme from "@theme";
import { useMemo } from "react";
import { z } from "zod";
import { categoriesQueryOptions } from "@/features/categories/queries";
import { siteConfigQuery, siteDomainQuery } from "@/features/config/queries";
import { postsInfiniteQueryOptions } from "@/features/posts/queries";
import { PostTagNameSchema } from "@/features/posts/schema/posts.schema";
import { getNextPostTagFilter } from "@/features/posts/utils/post-tag-filter";
import { tagsQueryOptions } from "@/features/tags/queries";
import { buildCanonicalUrl, canonicalLink } from "@/lib/seo";
import { m } from "@/paraglide/messages";

const { postsPerPage } = theme.config.posts;

export const Route = createFileRoute("/_public/posts")({
  validateSearch: z.object({
    tagName: PostTagNameSchema,
    categoryName: PostTagNameSchema,
  }),
  component: RouteComponent,
  pendingComponent: PostsSkeleton,
  loaderDeps: ({ search: { tagName, categoryName } }) => ({
    tagName,
    categoryName,
  }),
  loader: async ({ context, deps }) => {
    const [, , domain, siteConfig] = await Promise.all([
      context.queryClient.prefetchInfiniteQuery(
        postsInfiniteQueryOptions({
          tagName: deps.tagName,
          categoryName: deps.categoryName,
          limit: postsPerPage,
        }),
      ),
      context.queryClient.prefetchQuery(tagsQueryOptions),
      context.queryClient.ensureQueryData(siteDomainQuery),
      context.queryClient.ensureQueryData(siteConfigQuery),
      context.queryClient.prefetchQuery(categoriesQueryOptions),
    ]);

    return {
      title: m.posts_title(),
      description: siteConfig.description,
      canonicalHref: buildCanonicalUrl(domain, "/posts", {
        tagName: deps.tagName,
        categoryName: deps.categoryName,
      }),
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
    links: [canonicalLink(loaderData?.canonicalHref ?? "/posts")],
  }),
});

function RouteComponent() {
  const { tagName, categoryName } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const { data: tags } = useSuspenseQuery(tagsQueryOptions);
  const { data: categories } = useSuspenseQuery(categoriesQueryOptions);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSuspenseInfiniteQuery(
      postsInfiniteQueryOptions({ tagName, categoryName, limit: postsPerPage }),
    );

  const posts = useMemo(() => {
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  const handleTagClick = (clickedTag?: string) => {
    navigate({
      search: { ...getNextPostTagFilter(tagName, clickedTag), categoryName },
      replace: true, // Replace history to avoid back-button clutter
    });
  };

  return (
    <theme.PostsPage
      posts={posts}
      tags={tags}
      categories={categories}
      selectedCategory={categoryName}
      onCategoryClick={(name) =>
        navigate({
          search: {
            tagName,
            categoryName: categoryName === name ? undefined : name,
          },
          replace: true,
        })
      }
      selectedTag={tagName}
      onTagClick={handleTagClick}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
    />
  );
}

function PostsSkeleton() {
  return <theme.PostsPageSkeleton />;
}
