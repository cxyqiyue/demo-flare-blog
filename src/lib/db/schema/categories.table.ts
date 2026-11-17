import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, id } from "./helper";
import { PostsTable } from "./posts.table";

export const CategoriesTable = sqliteTable("categories", {
  id,
  name: text().notNull().unique(),
  createdAt,
});

/** A post belongs to at most one category; tags remain independent. */
export const PostCategoriesTable = sqliteTable("post_categories", {
  postId: integer("post_id")
    .primaryKey()
    .references(() => PostsTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => CategoriesTable.id, {
    onDelete: "set null",
  }),
  publicCategoryId: integer("public_category_id").references(
    () => CategoriesTable.id,
    { onDelete: "set null" },
  ),
});
