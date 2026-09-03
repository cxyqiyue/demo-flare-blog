import { count, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { CommentsTable, user } from "@/lib/db/schema";

export interface GetUsersOptions {
  offset?: number;
  limit?: number;
  search?: string;
}

function searchCondition(search?: string) {
  const term = search?.trim();
  return term
    ? or(like(user.name, `%${term}%`), like(user.email, `%${term}%`))
    : undefined;
}

export async function getAllUsers(db: DB, options: GetUsersOptions = {}) {
  const { offset = 0, limit = 20, search } = options;

  const conditions = searchCondition(search);

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      createdAt: user.createdAt,
      totalComments: sql<number>`(select count(*) from ${CommentsTable} where ${CommentsTable.userId} = ${user.id})`,
    })
    .from(user)
    .where(conditions)
    .orderBy(desc(user.createdAt))
    .limit(Math.min(limit, 100))
    .offset(offset);

  return rows;
}

export async function getUsersCount(db: DB, search?: string) {
  const conditions = searchCondition(search);

  const [row] = await db
    .select({ value: count() })
    .from(user)
    .where(conditions);

  return row?.value ?? 0;
}

export async function getUserById(db: DB, userId: string) {
  const [row] = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return row ?? null;
}

export async function getAuthorAccountOptions(db: DB) {
  return db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(or(isNull(user.banned), eq(user.banned, false)))
    .orderBy(user.name);
}

export async function setUserRole(db: DB, userId: string, role: string | null) {
  const [row] = await db
    .update(user)
    .set({ role })
    .where(eq(user.id, userId))
    .returning();

  return row;
}

export async function setUserBan(
  db: DB,
  userId: string,
  banned: boolean,
  banReason: string | null = null,
) {
  const [row] = await db
    .update(user)
    .set({ banned, banReason: banned ? banReason : null })
    .where(eq(user.id, userId))
    .returning();

  return row;
}
