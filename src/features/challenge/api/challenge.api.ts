import { createServerFn } from "@tanstack/react-start";
import {
  createAltchaChallengePayload,
  getChallengeClientConfig,
} from "@/features/challenge/service/challenge.service";
import { dbMiddleware } from "@/lib/middlewares";

export const getChallengeConfigFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(({ context }) => getChallengeClientConfig(context));

export const getAltchaChallengeFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const config = await getChallengeClientConfig(context);
    return createAltchaChallengePayload(context.env, config.difficulty);
  });
