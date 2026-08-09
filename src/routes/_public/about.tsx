import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import theme from "@theme";
import { siteConfigQuery, siteDomainQuery } from "@/features/config/queries";
import { postBySlugQuery } from "@/features/posts/queries";
import { authClient } from "@/lib/auth/auth.client";
import { buildCanonicalUrl, canonicalLink } from "@/lib/seo";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_public/about")({
  component: AboutPage,
  loader: async ({ context }) => {
    const [post, domain, siteConfig] = await Promise.all([
      context.queryClient.ensureQueryData(postBySlugQuery("about")),
      context.queryClient.ensureQueryData(siteDomainQuery),
      context.queryClient.ensureQueryData(siteConfigQuery),
    ]);

    return {
      post,
      authorName: siteConfig.author,
      canonicalHref: buildCanonicalUrl(domain, "/about"),
      title: post?.title ?? m.nav_about(),
      description: post?.summary ?? "",
    };
  },
  head: ({ loaderData }) => {
    const title = loaderData?.title;
    const description = loaderData?.description ?? "";
    const canonicalHref = loaderData?.canonicalHref ?? "";

    return {
      meta: [
        {
          title,
        },
        {
          name: "description",
          content: description,
        },
        { property: "og:title", content: title ?? "" },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonicalHref },
      ],
      links: [canonicalLink(canonicalHref)],
    };
  },
  pendingComponent: theme.AboutPageSkeleton,
  pendingMs: __THEME_CONFIG__.pendingMs,
});

function AboutPage() {
  const { data: post } = useSuspenseQuery(postBySlugQuery("about"));
  const { data: session } = authClient.useSession();

  return (
    <theme.AboutPage post={post} isAdmin={session?.user.role === "admin"} />
  );
}
