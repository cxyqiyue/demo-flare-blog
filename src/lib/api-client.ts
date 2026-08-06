import { hc } from "hono/client";
import type { PublicApiType } from "@/lib/hono/routes";

export const apiClient = hc<PublicApiType>("/api");
