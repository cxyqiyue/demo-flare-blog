import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkillSelector } from "@/features/skills/components/skill-selector";
import { TagSelector } from "@/features/tags/components/tag-selector";
import { toLocalDateString } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { PostEditorMetadata } from "./post-editor-metadata";

export function FlareEditorMetadata(
  props: ComponentProps<typeof PostEditorMetadata>,
) {
  const { post, onPostChange } = props;
  return (
    <div className="min-w-0 space-y-5">
      <label className="block space-y-2 text-sm font-medium">
        <span>{m.editor_title_placeholder()}</span>
        <Input
          value={post.title}
          onChange={(event) => onPostChange({ title: event.target.value })}
          className="text-xl font-semibold"
        />
      </label>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2 text-sm font-medium">
          <span>{m.editor_meta_status()}</span>
          <select
            className="min-h-10 w-full rounded-xl border border-border bg-background px-3"
            value={post.status}
            onChange={(event) =>
              onPostChange({ status: event.target.value as typeof post.status })
            }
          >
            <option value="draft">{m.editor_status_draft()}</option>
            <option value="published">{m.editor_status_published()}</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>{m.editor_meta_visibility()}</span>
          <select
            className="min-h-10 w-full rounded-xl border border-border bg-background px-3"
            value={post.visibility}
            onChange={(event) =>
              onPostChange({
                visibility: event.target.value as typeof post.visibility,
              })
            }
          >
            <option value="public">{m.editor_visibility_public()}</option>
            <option value="private">{m.editor_visibility_private()}</option>
            <option value="password">{m.editor_visibility_password()}</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>{m.editor_meta_author()}</span>
          {props.canEditAuthor ? (
            <select
              className="min-h-10 w-full rounded-xl border border-border bg-background px-3"
              value={post.authorId ?? ""}
              onChange={(event) => {
                const author = props.authorCandidates?.find(
                  (candidate) => candidate.id === event.target.value,
                );
                onPostChange({
                  authorId: author?.id ?? null,
                  author: author?.name ?? null,
                });
              }}
            >
              <option value="">
                {post.author || m.editor_meta_author_placeholder()}
              </option>
              {props.authorCandidates?.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="block py-2 text-muted-foreground">
              {post.author || "—"}
            </span>
          )}
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>{m.editor_meta_published_at()}</span>
          <Input
            type="date"
            value={post.publishedAt ? toLocalDateString(post.publishedAt) : ""}
            onChange={(event) =>
              onPostChange({
                publishedAt: event.target.value
                  ? new Date(`${event.target.value}T12:00:00Z`)
                  : null,
              })
            }
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>{m.editor_meta_read_time()}</span>
          <div className="flex flex-wrap gap-2">
            <Input
              type="number"
              min={1}
              value={post.readTimeInMinutes}
              onChange={(event) =>
                onPostChange({
                  readTimeInMinutes: Math.max(
                    1,
                    Number(event.target.value) || 1,
                  ),
                })
              }
              className="w-20"
            />
            <Button
              type="button"
              variant="outline"
              disabled={props.isCalculatingReadTime}
              onClick={props.onCalculateReadTime}
            >
              {m.editor_meta_auto_generate()}
            </Button>
          </div>
        </label>
        {post.status === "published" ? (
          <div className="space-y-2 text-sm font-medium">
            <span>{m.editor_meta_pin()}</span>
            <Button
              type="button"
              variant="outline"
              aria-pressed={!!post.pinnedAt}
              className="block"
              onClick={() =>
                onPostChange({ pinnedAt: post.pinnedAt ? null : new Date() })
              }
            >
              {post.pinnedAt
                ? m.editor_meta_pinned()
                : m.editor_meta_unpinned()}
            </Button>
          </div>
        ) : null}
      </div>
      {post.visibility === "password" ? (
        <div className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span>{m.editor_visibility_password_label()}</span>
            <Input
              value={post.password}
              onChange={(event) =>
                onPostChange({ password: event.target.value })
              }
            />
          </label>
          <Button
            type="button"
            variant="outline"
            className="self-end"
            disabled={props.isGeneratingPassword}
            onClick={props.onGeneratePassword}
          >
            {m.editor_meta_auto_generate()}
          </Button>
          <label className="space-y-2 text-sm">
            <span>{m.editor_visibility_channel_label()}</span>
            <Input
              value={post.passwordChannel}
              onChange={(event) =>
                onPostChange({ passwordChannel: event.target.value })
              }
            />
          </label>
          <label className="space-y-2 text-sm">
            <span>{m.editor_visibility_hint_label()}</span>
            <Input
              value={post.passwordHint}
              onChange={(event) =>
                onPostChange({ passwordHint: event.target.value })
              }
            />
          </label>
        </div>
      ) : null}
      <div className="space-y-2 text-sm font-medium">
        <label htmlFor="flare-post-slug">{m.editor_meta_slug()}</label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="flare-post-slug"
            className="min-w-0 flex-1 basis-48"
            value={post.slug}
            onChange={(event) => onPostChange({ slug: event.target.value })}
          />
          <Button
            type="button"
            variant="outline"
            disabled={props.isGeneratingSlug}
            onClick={props.onGenerateSlug}
          >
            {m.editor_meta_auto_generate()}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">{m.editor_meta_tags()}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={props.isGeneratingTags}
            onClick={props.onGenerateTags}
          >
            {m.editor_meta_auto_generate()}
          </Button>
        </div>
        <TagSelector
          value={post.tagIds}
          onChange={(tagIds) => onPostChange({ tagIds })}
        />
      </div>
      <div className="space-y-2">
        <span className="text-sm font-medium">{m.editor_meta_skill()}</span>
        <SkillSelector
          value={post.skillId}
          onChange={(skillId) => onPostChange({ skillId })}
        />
      </div>
      <div className="space-y-2 text-sm font-medium">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="flare-post-summary">{m.editor_meta_summary()}</label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={props.isGeneratingSummary}
            onClick={props.onGenerateSummary}
          >
            {m.editor_meta_auto_generate()}
          </Button>
        </div>
        <textarea
          id="flare-post-summary"
          value={post.summary}
          onChange={(event) => onPostChange({ summary: event.target.value })}
          rows={4}
          className="w-full resize-y rounded-xl border border-border bg-card p-3 text-base leading-7 focus-visible:outline-2 focus-visible:outline-primary sm:text-sm"
        />
      </div>
    </div>
  );
}
