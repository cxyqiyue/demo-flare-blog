import { createServerFn } from "@tanstack/react-start";
import {
  CreateSkillInputSchema,
  DeleteSkillInputSchema,
  GetSkillByIdInputSchema,
  GetSkillsInputSchema,
  ImportSkillsInputSchema,
  UpdateSkillInputSchema,
} from "@/features/skills/skills.schema";
import * as SkillService from "@/features/skills/skills.service";
import { adminMiddleware, superAdminMiddleware } from "@/lib/middlewares";

export const getSkillsFn = createServerFn()
  .middleware([adminMiddleware])
  .inputValidator(GetSkillsInputSchema)
  .handler(async ({ data, context }) => {
    return await SkillService.getSkills(context, data);
  });

export const getSkillByIdFn = createServerFn()
  .middleware([adminMiddleware])
  .inputValidator(GetSkillByIdInputSchema)
  .handler(async ({ data, context }) => {
    return await SkillService.getSkillById(context, data.id);
  });

export const createSkillFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .inputValidator(CreateSkillInputSchema)
  .handler(({ data, context }) => SkillService.createSkill(context, data));

export const updateSkillFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .inputValidator(UpdateSkillInputSchema)
  .handler(({ data, context }) => SkillService.updateSkill(context, data));

export const deleteSkillFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .inputValidator(DeleteSkillInputSchema)
  .handler(({ data, context }) => SkillService.deleteSkill(context, data));

export const importSkillsFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .inputValidator(ImportSkillsInputSchema)
  .handler(({ data, context }) =>
    SkillService.importSkillsFromMarkdown(context, data),
  );
