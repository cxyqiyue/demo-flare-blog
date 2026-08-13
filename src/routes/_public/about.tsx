import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import theme from "@theme";
import { AboutMarkdownEditor } from "@/features/about/components/about-markdown-editor";
import {
  ABOUT_KEYS,
  aboutArticleQuery,
} from "@/features/about/queries";
import { saveAboutArticleFn } from "@/features/about/api/about.api";
import { markdownToPlainText } from "@/features/about/utils/markdown";
import { siteConfigQuery, siteDomainQuery } from "@/features/config/queries";
import { authClient } from "@/lib/auth/auth.client";
import { buildCanonicalUrl, canonicalLink } from "@/lib/seo";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_public/about")({
  component: AboutPage,
  loader: async ({ context }) => {
    const [article, domain, siteConfig] = await Promise.all([
      context.queryClient.ensureQueryData(aboutArticleQuery()),
      context.queryClient.ensureQueryData(siteDomainQuery),
      context.queryClient.ensureQueryData(siteConfigQuery),
    ]);

    return {
      authorName: siteConfig.author,
      canonicalHref: buildCanonicalUrl(domain, "/about"),
      title: article?.title ?? m.nav_about(),
      description: article ? markdownToPlainText(article.markdown).slice(0, 160) : "",
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
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonicalHref },
      ],
      links: [canonicalLink(canonicalHref)],
    };
  },
  pendingComponent: theme.AboutPageSkeleton,
  pendingMs: __THEME_CONFIG__.pendingMs,
});

function AboutPage() {
  const { data: article } = useSuspenseQuery(aboutArticleQuery());
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin = session?.user.role === "admin";
  const showEditor = isAdmin && (editing || !article);

  const onSave = async (title: string, markdown: string): Promise<boolean> => {
    if (saving) return false;
    setSaving(true);
    try {
      const result = await saveAboutArticleFn({
        data: { title, markdown },
      });
      if (result.error) {
        toast.error(m.about_save_error());
        return false;
      }
      await queryClient.invalidateQueries({
        queryKey: ABOUT_KEYS.all,
      });
      setEditing(false);
      toast.success(m.about_save_success());
      return true;
    } catch {
      toast.error(m.about_save_error());
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (showEditor) {
    return (
      <AboutMarkdownEditor
        initialTitle={article?.title ?? ""}
        initialMarkdown={article?.markdown ?? ""}
        isSubmitting={saving}
        previewClassName={theme.markdownClassName}
        onSubmit={onSave}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <theme.AboutPage
      article={article}
      isAdmin={isAdmin}
      onStartEdit={() => setEditing(true)}
    />
  );
}
