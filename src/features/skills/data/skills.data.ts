import { and, asc, count, desc, eq, ne, sql } from "drizzle-orm";
import { PostsTable, SkillsTable } from "@/lib/db/schema";

export async function getAllSkills(
  db: DB,
  options: {
    sortBy?: "name" | "createdAt";
    sortDir?: "asc" | "desc";
  } = {},
) {
  const { sortBy = "name", sortDir = "asc" } = options;

  const orderFn = sortDir === "asc" ? asc : desc;
  const orderColumn =
    sortBy === "createdAt" ? SkillsTable.createdAt : SkillsTable.name;

  return await db.select().from(SkillsTable).orderBy(orderFn(orderColumn));
}

export async function getAllSkillsWithCount(
  db: DB,
  options: {
    sortBy?: "name" | "createdAt" | "postCount";
    sortDir?: "asc" | "desc";
  } = {},
) {
  const { sortBy = "name", sortDir = "asc" } = options;

  const query = db
    .select({
      id: SkillsTable.id,
      name: SkillsTable.name,
      description: SkillsTable.description,
      createdAt: SkillsTable.createdAt,
      updatedAt: SkillsTable.updatedAt,
      postCount: count(PostsTable.id).as("postCount"),
    })
    .from(SkillsTable)
    .leftJoin(PostsTable, eq(SkillsTable.id, PostsTable.skillId))
    .groupBy(SkillsTable.id)
    .$dynamic();

  const orderFn = sortDir === "asc" ? asc : desc;

  if (sortBy === "postCount") {
    query.orderBy(orderFn(sql`postCount`));
  } else if (sortBy === "createdAt") {
    query.orderBy(orderFn(SkillsTable.createdAt));
  } else {
    query.orderBy(orderFn(SkillsTable.name));
  }

  return await query;
}

export async function findSkillById(db: DB, id: number) {
  return await db.query.SkillsTable.findFirst({
    where: eq(SkillsTable.id, id),
  });
}

export async function findSkillByName(db: DB, name: string) {
  return await db.query.SkillsTable.findFirst({
    where: eq(SkillsTable.name, name),
  });
}

export async function insertSkill(
  db: DB,
  data: typeof SkillsTable.$inferInsert,
) {
  const [skill] = await db.insert(SkillsTable).values(data).returning();
  return skill;
}

export async function updateSkill(
  db: DB,
  id: number,
  data: Partial<Omit<typeof SkillsTable.$inferInsert, "id" | "createdAt">>,
) {
  const [skill] = await db
    .update(SkillsTable)
    .set(data)
    .where(eq(SkillsTable.id, id))
    .returning();
  return skill;
}

export async function deleteSkill(db: DB, id: number) {
  await db.delete(SkillsTable).where(eq(SkillsTable.id, id));
}

export async function skillNameExists(
  db: DB,
  name: string,
  options: { excludeId?: number } = {},
): Promise<boolean> {
  const { excludeId } = options;
  const conditions = [eq(SkillsTable.name, name)];
  if (excludeId) {
    conditions.push(ne(SkillsTable.id, excludeId));
  }
  const results = await db
    .select({ id: SkillsTable.id })
    .from(SkillsTable)
    .where(and(...conditions))
    .limit(1);
  return results.length > 0;
}
