import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import * as CacheService from "@/features/cache/cache.service";
import {
  CONFIG_CACHE_KEYS,
  DEFAULT_CONFIG,
} from "@/features/config/config.schema";
import * as ConfigRepo from "@/features/config/data/config.data";
import { app } from "@/lib/hono";
import { createTestDb, testRequest } from "tests/test-utils";

async function seedWechatVerify(fileName: string, fileContent: string) {
  await ConfigRepo.upsertSystemConfig(createTestDb(), {
    ...DEFAULT_CONFIG,
    wechatVerify: { fileName, fileContent },
  });
  await CacheService.deleteKey({ env }, CONFIG_CACHE_KEYS.system);
}

describe("Wechat Verify Route", () => {
  beforeEach(async () => {
    // Ensure no verification file is configured by default
    await seedWechatVerify("", "");
  });

  it("serves the configured verification file at the site root", async () => {
    await seedWechatVerify("wx-verify-123.txt", "verify-content-abc");

    const res = await testRequest(app, "/wx-verify-123.txt");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("verify-content-abc");
    expect(res.headers.get("Content-Type")).toContain("text/plain");
  });

  it("returns 404 for a file name that does not match the configured one", async () => {
    await seedWechatVerify("configured.txt", "content");

    const res = await testRequest(app, "/some-other-file.txt");
    expect(res.status).toBe(404);
  });

  it("returns 404 when no verification file is configured", async () => {
    const res = await testRequest(app, "/wx-verify-123.txt");
    expect(res.status).toBe(404);
  });
});
