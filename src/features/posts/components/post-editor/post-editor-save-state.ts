import type { PostEditorData } from "./types";

/** Fields persisted by the editor, shared by auto-save and public sync checks. */
export function toPostEditorSnapshot(post: PostEditorData) {
  return {
    title: post.title,
    summary: post.summary,
    slug: post.slug,
    status: post.status,
    readTimeInMinutes: post.readTimeInMinutes,
    publishedAt: post.publishedAt?.valueOf() ?? null,
    pinnedAt: post.pinnedAt?.valueOf() ?? null,
    tagIds: [...post.tagIds].sort((a, b) => a - b).join(","),
    categoryId: post.categoryId ?? null,
    skillId: post.skillId,
    contentRef: post.contentJson,
    visibility: post.visibility,
    password: post.password,
    passwordChannel: post.passwordChannel,
    passwordHint: post.passwordHint,
  };
}

type PostEditorSnapshot = ReturnType<typeof toPostEditorSnapshot>;

export function arePostEditorSnapshotsEqual(
  previous: PostEditorSnapshot,
  current: PostEditorSnapshot,
): boolean {
  return (Object.keys(previous) as Array<keyof PostEditorSnapshot>).every(
    (key) => previous[key] === current[key],
  );
}
