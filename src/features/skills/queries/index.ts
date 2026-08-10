import { queryOptions } from "@tanstack/react-query";
import { getSkillsFn } from "../api/skills.api";
import type { GetSkillsInput } from "../skills.schema";

export const SKILLS_KEYS = {
  all: ["skills"] as const,
  admin: ["skills", "admin"] as const,
  adminList: (filters: GetSkillsInput) => ["skills", "admin", filters] as const,
};

export function skillsAdminQueryOptions(options: GetSkillsInput = {}) {
  return queryOptions({
    queryKey: SKILLS_KEYS.adminList(options),
    queryFn: () => getSkillsFn({ data: options }),
    staleTime: Infinity,
  });
}
