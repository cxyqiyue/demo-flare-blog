import { applyD1Migrations, reset } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach } from "vitest";
import { drainTestExecutionContexts } from "./test-utils";

// Setup files run outside per-test-file storage isolation. Cloudflare's
// applyD1Migrations() only applies migrations that have not already run.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

afterEach(async () => {
  await drainTestExecutionContexts();
  await reset();
});
