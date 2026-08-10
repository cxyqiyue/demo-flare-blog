import { queryOptions } from "@tanstack/react-query";
import {
  getAltchaChallengeFn,
  getChallengeConfigFn,
} from "../api/challenge.api";

export const CHALLENGE_KEYS = {
  config: ["challenge", "config"] as const,
  altcha: ["challenge", "altcha"] as const,
};

export const challengeConfigQuery = queryOptions({
  queryKey: CHALLENGE_KEYS.config,
  queryFn: () => getChallengeConfigFn(),
});

export const altchaChallengeQuery = queryOptions({
  queryKey: CHALLENGE_KEYS.altcha,
  queryFn: () => getAltchaChallengeFn(),
  staleTime: 0,
});
