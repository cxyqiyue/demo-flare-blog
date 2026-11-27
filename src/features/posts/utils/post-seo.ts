import type { PostWithToc } from "@/features/posts/schema/posts.schema";
import { buildArticleJsonLd, canonicalLink } from "@/lib/seo";

type PostSeoInput = {
  authorName: string;
  canonicalHref: string;
  post?: Pick<
    NonNullable<PostWithToc>,
    | "slug"
    | "title"
    | "summary"
    | "visibility"
    | "gate"
    | "publishedAt"
    | "updatedAt"
    | "tags"
  > | null;
};

/** Only unrestricted public posts may publish summaries and Article metadata. */
export function buildPostHead({ post, authorName, canonicalHref }: PostSeoInput) {
  const isPublic = post?.visibility === "public" && !post.gate;
  const title = post?.gate === "private" ? "" : (post?.title ?? "");
  const summary = isPublic ? (post.summary ?? "") : "";

  return {
    meta: [
      { title },
      { name: "description", content: summary },
      { property: "og:title", content: title },
      { property: "og:description", content: summary },
      { property: "og:type", content: "article" },
      { property: "og:url", content: canonicalHref },
      ...(!isPublic
        ? [{ name: "robots", content: "noindex, nofollow, noarchive" }]
        : []),
    ],
    links: [canonicalLink(canonicalHref)],
    scripts: isPublic
      ? [{
          type: "application/ld+json",
          children: buildArticleJsonLd({ authorName, canonicalHref, post }),
        }]
      : [],
  };
}
