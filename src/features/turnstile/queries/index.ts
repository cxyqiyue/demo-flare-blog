import { queryOptions } from "@tanstack/react-query";
import { getTurnstileConfigFn } from "../api/turnstile.api";

export const TURNSTILE_KEYS = {
  config: ["turnstile", "config"] as const,
};

export const turnstileConfigQuery = queryOptions({
  queryKey: TURNSTILE_KEYS.config,
  queryFn: () => getTurnstileConfigFn(),
});
