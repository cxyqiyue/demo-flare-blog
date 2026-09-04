import type { JSONContent } from "@tiptap/react";
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { createdAt, id, updatedAt } from "./helper";
import { user } from "./auth.table";
import { SkillsTable } from "./skills.table";

export const POST_STATUSES = ["draft", "published"] as const;

export const POST_VISIBILITIES = ["public", "private", "password"] as const;

export const PostsTable = sqliteTable(
  "posts",
  {
    id,
    title: text().notNull(),
    summary: text(),
    readTimeInMinutes: integer("read_time_in_minutes").default(1).notNull(),
    slug: text().notNull().unique(),

    contentJson: text("content_json", { mode: "json" }).$type<JSONContent>(),
    publicContentJson: text("public_content_json", {
      mode: "json",
    }).$type<JSONContent>(),
    /** publicContentJson 的渲染版本号，用于懒加载重新渲染 */
    publicContentRenderVersion: text("public_content_render_version"),
    status: text("status", { enum: POST_STATUSES }).notNull().default("draft"),
    visibility: text("visibility", { enum: POST_VISIBILITIES })
      .notNull()
      .default("public"),
    /** 访问密码的 SHA-256 摘要，用于恒时校验；明文永不入库 */
    passwordHash: text("password_hash"),
    /** 访问密码的 AES-256-GCM 密文，仅在管理端按需解密展示 */
    passwordCipher: text("password_cipher"),
    /** 获取访问密码的渠道链接（前台「获取密码」按钮跳转） */
    passwordChannel: text("password_channel"),
    /** 密码获取提示：管理端可选填写的文本提示，前台密码弹窗内展示 */
    passwordHint: text("password_hint"),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    pinnedAt: integer("pinned_at", { mode: "timestamp" }),
    skillId: integer("skill_id").references(() => SkillsTable.id, {
      onDelete: "set null",
    }),
    /** 作者/创建者用户 ID。普通管理员只能管理自己创建的文章；超级管理员可管理全部。 */
    authorId: text("author_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("published_at_idx").on(table.publishedAt, table.status),
    index("created_at_idx").on(table.createdAt),
    index("author_id_idx").on(table.authorId),
  ],
);

export const TagsTable = sqliteTable("tags", {
  id,
  name: text().notNull().unique(),
  createdAt,
});

export const PostTagsTable = sqliteTable(
  "post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => PostsTable.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => TagsTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index("post_tags_tag_idx").on(table.tagId),
  ],
);

// ==================== relations ====================
export const postsRelations = relations(PostsTable, ({ many, one }) => ({
  postTags: many(PostTagsTable),
  skill: one(SkillsTable, {
    fields: [PostsTable.skillId],
    references: [SkillsTable.id],
  }),
  author: one(user, {
    fields: [PostsTable.authorId],
    references: [user.id],
  }),
}));

export const tagsRelations = relations(TagsTable, ({ many }) => ({
  postTags: many(PostTagsTable),
}));

export const postTagsRelations = relations(PostTagsTable, ({ one }) => ({
  post: one(PostsTable, {
    fields: [PostTagsTable.postId],
    references: [PostsTable.id],
  }),
  tag: one(TagsTable, {
    fields: [PostTagsTable.tagId],
    references: [TagsTable.id],
  }),
}));

// ==================== types ====================
export type Tag = typeof TagsTable.$inferSelect;
export type Post = typeof PostsTable.$inferSelect;
export type PostStatus = (typeof POST_STATUSES)[number];
export type PostVisibility = (typeof POST_VISIBILITIES)[number];
