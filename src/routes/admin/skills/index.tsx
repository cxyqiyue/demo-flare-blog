import { createFileRoute } from "@tanstack/react-router";
import { SkillManager } from "@/features/skills/components/skill-manager";
import { skillsAdminQueryOptions } from "@/features/skills/queries";
import { requireSuperAdminRoute } from "@/lib/auth/route-guards";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/admin/skills/")({
  ssr: "data-only",
  beforeLoad: requireSuperAdminRoute,
  component: SkillManagerRoute,
  loader: async ({ context }) => {
    // Prefetch skills for a smooth load
    await context.queryClient.prefetchQuery(skillsAdminQueryOptions());
    return {
      title: m.skills_manager_title(),
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title,
      },
    ],
  }),
});

function SkillManagerRoute() {
  return <SkillManager />;
}
