import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { AboutArticleTable } from "@/lib/db/schema";

// Date fields need to accept both Date objects and ISO strings (for JSON serialization)
const coercedDate = z.union([z.date(), z.string().pipe(z.coerce.date())]);

export const AboutArticleSchema = createSelectSchema(AboutArticleTable, {
  createdAt: coercedDate,
  updatedAt: coercedDate,
});

export const SaveAboutArticleInputSchema = z.object({
  title: z.string().max(200),
  markdown: z.string().max(200000),
});

export type AboutArticle = z.infer<typeof AboutArticleSchema>;
export type SaveAboutArticleInput = z.infer<typeof SaveAboutArticleInputSchema>;
