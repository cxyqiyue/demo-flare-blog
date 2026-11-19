import { queryOptions } from "@tanstack/react-query";
import {
  getAltchaChallengeFn,
  getChallengeConfigFn,
} from "../api/challenge.api";
import { getFullSiteLockedFn } from "../api/fullsite.api";

export const CHALLENGE_KEYS = {
  config: ["challenge", "config"] as const,
  altcha: ["challenge", "altcha"] as const,
  fullSiteLocked: ["challenge", "full-site-locked"] as const,
};

export const challengeConfigQuery = queryOptions({
  queryKey: CHALLENGE_KEYS.config,
  queryFn: () => getChallengeConfigFn(),
});

export const fullSiteLockedQuery = queryOptions({
  queryKey: CHALLENGE_KEYS.fullSiteLocked,
  queryFn: () => getFullSiteLockedFn(),
  // The check reads persisted challenge settings. Cache it briefly so route
  // transitions do not wait for another server round-trip every time.
  staleTime: 30 * 1000,
});

export const altchaChallengeQuery = queryOptions({
  queryKey: CHALLENGE_KEYS.altcha,
  queryFn: () => getAltchaChallengeFn(),
  staleTime: 0,
});
