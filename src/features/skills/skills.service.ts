import { eq } from "drizzle-orm";
import * as SkillRepo from "@/features/skills/data/skills.data";
import type {
  CreateSkillInput,
  DeleteSkillInput,
  GetSkillsInput,
  ImportSkillsInput,
  Skill,
  SkillWithCount,
  UpdateSkillInput,
} from "@/features/skills/skills.schema";
import { PostsTable } from "@/lib/db/schema";
import { err, ok } from "@/lib/errors";

/**
 * Parse a Markdown document into a list of { name, description } skills.
 *
 * Each `#` / `##` heading becomes a skill name; the text between the heading
 * and the next heading becomes its description (trimmed).
 */
export function parseSkillsMarkdown(
  markdown: string,
): Array<{ name: string; description: string }> {
  const skills: Array<{ name: string; description: string }> = [];
  const lines = markdown.split(/\r?\n/);
  let current: { name: string; description: string } | null = null;

  const headingRegex = /^(#{1,6})\s+(.+)$/;

  for (const line of lines) {
    const headingMatch = line.match(headingRegex);
    if (headingMatch) {
      if (current) skills.push(current);
      current = { name: headingMatch[2].trim(), description: "" };
      continue;
    }
    if (current) {
      const trimmed = line.trim();
      if (trimmed) {
        current.description = current.description
          ? `${current.description}\n${trimmed}`
          : trimmed;
      }
    }
  }

  if (current) skills.push(current);

  return skills.filter((skill) => skill.name.length > 0);
}

/**
 * Get all skills with their post counts (admin management).
 */
export async function getSkills(
  context: DbContext,
  data: GetSkillsInput = {},
): Promise<Array<SkillWithCount>> {
  const { sortBy = "postCount", sortDir = "desc" } = data;
  return await SkillRepo.getAllSkillsWithCount(context.db, { sortBy, sortDir });
}

/**
 * Get a single skill by id.
 */
export async function getSkillById(
  context: DbContext,
  skillId: number,
): Promise<Skill | null> {
  const skill = await SkillRepo.findSkillById(context.db, skillId);
  return skill ?? null;
}

// ============ Admin Service Methods ============

export async function createSkill(context: DbContext, data: CreateSkillInput) {
  const name = data.name.trim();
  const description = data.description?.trim() || null;

  const exists = await SkillRepo.skillNameExists(context.db, name);
  if (exists) {
    return err({ reason: "SKILL_NAME_ALREADY_EXISTS" });
  }

  const skill = await SkillRepo.insertSkill(context.db, {
    name,
    description,
  });

  return ok(skill);
}

export async function updateSkill(
  context: DbContext,
  data: UpdateSkillInput,
) {
  const existingSkill = await SkillRepo.findSkillById(context.db, data.id);
  if (!existingSkill) {
    return err({ reason: "SKILL_NOT_FOUND" });
  }

  const nextData: { name?: string; description?: string | null } = {};

  if (data.data.name !== undefined) {
    const nextName = data.data.name.trim();
    if (nextName !== existingSkill.name) {
      const exists = await SkillRepo.skillNameExists(context.db, nextName, {
        excludeId: data.id,
      });
      if (exists) {
        return err({ reason: "SKILL_NAME_ALREADY_EXISTS" });
      }
    }
    nextData.name = nextName;
  }
  if (data.data.description !== undefined) {
    nextData.description = data.data.description.trim() || null;
  }

  const skill = await SkillRepo.updateSkill(context.db, data.id, nextData);

  return ok(skill);
}

export async function deleteSkill(
  context: DbContext,
  data: DeleteSkillInput,
) {
  const skill = await SkillRepo.findSkillById(context.db, data.id);
  if (!skill) {
    return err({ reason: "SKILL_NOT_FOUND" });
  }

  // Detach published/draft posts from the skill before deleting
  await context.db
    .update(PostsTable)
    .set({ skillId: null })
    .where(eq(PostsTable.skillId, data.id));

  await SkillRepo.deleteSkill(context.db, data.id);

  return ok({ success: true });
}

/**
 * Import skills from a Markdown document. Existing skills are skipped.
 */
export async function importSkillsFromMarkdown(
  context: DbContext,
  data: ImportSkillsInput,
) {
  const parsed = parseSkillsMarkdown(data.markdown);

  let created = 0;
  const skipped: Array<string> = [];

  for (const item of parsed) {
    const exists = await SkillRepo.skillNameExists(context.db, item.name);
    if (exists) {
      skipped.push(item.name);
      continue;
    }
    await SkillRepo.insertSkill(context.db, {
      name: item.name,
      description: item.description || null,
    });
    created++;
  }

  return { total: parsed.length, created, skipped };
}
