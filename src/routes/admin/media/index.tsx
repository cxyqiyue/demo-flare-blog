import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MediaLibrary } from "@/features/media/components/media-library";
import { requireSuperAdminRoute } from "@/lib/auth/route-guards";
import { m } from "@/paraglide/messages";

const mediaSearchSchema = z.object({
  unused: z.boolean().optional().catch(false),
  search: z.string().optional().catch(""),
  folder: z.string().optional().catch(""),
  view: z.enum(["grid", "table"]).optional().catch("grid"),
  provider: z.string().optional().catch("r2"),
  sortBy: z.enum(["name", "size", "time"]).optional().catch("name"),
  sortDir: z.enum(["asc", "desc"]).optional().catch("asc"),
  copyFormat: z
    .enum(["url", "markdown", "html", "bbcode"])
    .optional()
    .catch("url"),
});

export const Route = createFileRoute("/admin/media/")({
  ssr: false,
  validateSearch: mediaSearchSchema,
  beforeLoad: requireSuperAdminRoute,
  component: MediaLibrary,
  loader: () => ({
    title: m.media_title(),
  }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title,
      },
    ],
  }),
});
