import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { JSONContent } from "@tiptap/react";
import { useState } from "react";
import { toast } from "sonner";
import theme from "@theme";
import { siteConfigQuery, siteDomainQuery } from "@/features/config/queries";
import { AboutEditor } from "@/features/posts/components/about-editor";
import { saveAboutPostFn } from "@/features/posts/api/posts.admin.api";
import { POSTS_KEYS, postBySlugQuery } from "@/features/posts/queries";
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
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin = session?.user.role === "admin";
  const showEditor = isAdmin && (editing || !post);

  const onSave = async (content: JSONContent): Promise<boolean> => {
    if (saving) return false;
    setSaving(true);
    try {
      const result = await saveAboutPostFn({ data: { contentJson: content } });
      if (result.error) {
        toast.error(m.about_save_error());
        return false;
      }
      await queryClient.invalidateQueries({
        queryKey: POSTS_KEYS.detail("about"),
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
      <div className="w-full max-w-3xl mx-auto pb-20 px-6 md:px-0 pt-10">
        <AboutEditor
          initialContent={post?.contentJson}
          isSubmitting={saving}
          onSubmit={onSave}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <theme.AboutPage
      post={post}
      isAdmin={isAdmin}
      onStartEdit={() => setEditing(true)}
    />
  );
}
