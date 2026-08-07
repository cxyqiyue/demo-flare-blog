import * as CacheService from "@/features/cache/cache.service";
import type { UpdateCheckResult } from "@/features/version/version.schema";
import {
  GitHubReleaseSchema,
  UpdateCheckResultSchema,
  VERSION_CACHE_KEYS,
} from "@/features/version/version.schema";
import { serverEnv } from "@/lib/env/server.env";
import type { Result } from "@/lib/errors";
import { err, ok } from "@/lib/errors";

const GITHUB_REPO = "cxyqiyue/demo-flare-blog";

type CheckForUpdateResult = Result<
  UpdateCheckResult,
  { reason: "FETCH_FAILED" }
>;

/**
 * 检查版本更新
 * @param context
 * @param force 是否强制跳过缓存直接检查
 */
export async function checkForUpdate(
  context: BaseContext & { executionCtx: ExecutionContext },
  force = false,
): Promise<CheckForUpdateResult> {
  const fetcher = async () => {
    const headers: Record<string, string> = {
      "User-Agent": "demo-flare-blog",
      Accept: "application/vnd.github.v3+json",
    };

    const githubToken = serverEnv(context.env).GITHUB_TOKEN;
    if (githubToken) {
      headers.Authorization = `Bearer ${githubToken}`;
    }

    const currentVersion = __APP_VERSION__;
    const githubApi = (path: string) =>
      fetch(`https://api.github.com/repos/${GITHUB_REPO}${path}`, {
        headers,
      });

    const releaseResponse = await githubApi("/releases/latest");

    if (releaseResponse.status === 404) {
      // 仓库没有 Release：尝试读取最新 tag，避免检查更新永远失败。
      const tagsResponse = await githubApi("/tags?per_page=1");
      if (tagsResponse.ok) {
        const tags = (await tagsResponse.json()) as Array<{ name?: string }>;
        const latestTag = tags[0]?.name;
        if (latestTag) {
          return {
            latestVersion: latestTag,
            currentVersion,
            hasUpdate: isNewer(latestTag, currentVersion),
            releaseUrl: `https://github.com/${GITHUB_REPO}/tags`,
            publishedAt: undefined,
            checkedAt: Date.now(),
          };
        }
      }

      // 既没有 Release 也没有 tag：视为当前已是最新。
      return {
        latestVersion: currentVersion,
        currentVersion,
        hasUpdate: false,
        releaseUrl: `https://github.com/${GITHUB_REPO}`,
        publishedAt: undefined,
        checkedAt: Date.now(),
      };
    }

    if (!releaseResponse.ok) {
      const body = await releaseResponse.text().catch(() => "");
      throw new Error(
        `GitHub API error: ${releaseResponse.status} ${releaseResponse.statusText}${body ? ` - ${body.slice(0, 500)}` : ""}`,
      );
    }

    const json = await releaseResponse.json();
    const data = GitHubReleaseSchema.parse(json);
    const latestVersion = data.tag_name; // 比如 "v0.6.0"

    return {
      latestVersion,
      currentVersion,
      hasUpdate: isNewer(latestVersion, currentVersion),
      releaseUrl: data.html_url,
      publishedAt: data.published_at,
      checkedAt: Date.now(),
    };
  };

  try {
    let data: UpdateCheckResult;

    if (force) {
      data = await fetcher();
      context.executionCtx.waitUntil(
        CacheService.set(
          context,
          VERSION_CACHE_KEYS.updateCheck,
          JSON.stringify(data),
          { ttl: "5m" },
        ),
      );
    } else {
      data = await CacheService.get(
        context,
        VERSION_CACHE_KEYS.updateCheck,
        UpdateCheckResultSchema,
        fetcher,
        { ttl: "5m" },
      );
    }

    return ok(data);
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "version check failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return err({ reason: "FETCH_FAILED" });
  }
}

function isNewer(latest: string, current: string) {
  const l = latest
    .replace(/^v/, "")
    .split(".")
    .map((v) => parseInt(v, 10) || 0);
  const c = current
    .replace(/^v/, "")
    .split(".")
    .map((v) => parseInt(v, 10) || 0);

  // 长度补齐
  const length = Math.max(l.length, c.length);
  for (let i = 0; i < length; i++) {
    const lPart = l[i] || 0;
    const cPart = c[i] || 0;
    if (lPart > cPart) return true;
    if (lPart < cPart) return false;
  }
  return false;
}
