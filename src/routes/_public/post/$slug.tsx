import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import theme from "@theme";
import { useEffect } from "react";
import { z } from "zod";
import { siteConfigQuery, siteDomainQuery } from "@/features/config/queries";
import { recordPageViewFn } from "@/features/pageview/api/pageview.api";
import { postBySlugQuery, relatedPostsQuery } from "@/features/posts/queries";
import { CACHE_CONTROL } from "@/lib/constants";
import {
  buildArticleJsonLd,
  buildCanonicalUrl,
  canonicalLink,
} from "@/lib/seo";

const searchSchema = z.object({
  highlightCommentId: z.coerce.number().optional(),
  rootId: z.number().optional(),
});

const { relatedPostsLimit } = theme.config.post;

export const Route = createFileRoute("/_public/post/$slug")({
  validateSearch: searchSchema,
  component: RouteComponent,
  loader: async ({ context, params }) => {
    // 1. Critical: Main post data - use serverFn (executes directly on server, no HTTP)
    const [post, domain, siteConfig] = await Promise.all([
      context.queryClient.ensureQueryData(postBySlugQuery(params.slug)),
      context.queryClient.ensureQueryData(siteDomainQuery),
      context.queryClient.ensureQueryData(siteConfigQuery),
    ]);

    // 2. Deferred: Related posts (prefetch only, don't await)
    void context.queryClient.prefetchQuery(
      relatedPostsQuery(params.slug, relatedPostsLimit),
    );

    if (!post) throw notFound();

    return {
      post,
      authorName: siteConfig.author,
      canonicalHref: buildCanonicalUrl(
        domain,
        `/post/${encodeURIComponent(post.slug)}`,
      ),
    };
  },
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    const canonicalHref = loaderData?.canonicalHref ?? "";

    return {
      meta: [
        {
          title: post?.title,
        },
        {
          name: "description",
          content: post?.summary ?? "",
        },
        { property: "og:title", content: post?.title ?? "" },
        { property: "og:description", content: post?.summary ?? "" },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonicalHref },
      ],
      links: [canonicalLink(canonicalHref)],
      scripts: post
        ? [
            {
              type: "application/ld+json",
              children: buildArticleJsonLd({
                authorName: loaderData.authorName,
                canonicalHref,
                post,
              }),
            },
          ]
        : [],
    };
  },
  pendingComponent: () => <theme.PostPageSkeleton />,
  pendingMs: __THEME_CONFIG__.pendingMs,
  headers: ({ loaderData }) => {
    // 受限文章（私密/密码）若已解锁，SSR 页面会携带正文，绝不能进入共享缓存；
    // 未解锁时渲染的是壳，同样走 no-store（壳的 JSON 已由 detailGated 边缘缓存）。
    const isRestricted = loaderData?.post?.visibility !== "public";
    return isRestricted ? CACHE_CONTROL.private : CACHE_CONTROL.public;
  },
});

function RouteComponent() {
  const { slug } = Route.useParams();
  const { data: post } = useSuspenseQuery(postBySlugQuery(slug));

  useEffect(() => {
    if (!post?.id) return;
    try {
      const key = `pv:${post.id}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Safari private mode / storage disabled — record anyway
    }
    void recordPageViewFn({ data: { postId: post.id } });
  }, [post?.id]);

  if (!post) throw notFound();

  return <theme.PostPage post={post} />;
}
