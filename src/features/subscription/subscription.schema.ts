import { z } from "zod";

export const ToggleBlogSubscriptionInputSchema = z.object({
  enabled: z.boolean(),
});
export type ToggleBlogSubscriptionInput = z.infer<
  typeof ToggleBlogSubscriptionInputSchema
>;

export interface BlogSubscriptionStatus {
  available: boolean;
  subscribed: boolean;
}
