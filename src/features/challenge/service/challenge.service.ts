import {
  ALTCHA_CHALLENGE_TTL_SECONDS,
  createAltchaChallenge,
  encodeBase64Json,
  parseAltchaSolution,
  verifyAltchaSolution,
} from "@/features/challenge/pow/altcha";
import { guardedKvPut } from "@/features/cache/kv-write-guard";
import type {
  ChallengeProvider,
  ChallengeScope,
} from "@/features/config/config.schema";
import * as ConfigService from "@/features/config/service/config.service";
import { getDb } from "@/lib/db";
import { UsedChallengesTable } from "@/lib/db/schema";

const ALTCHA_SECRET_PREFIX = "altcha-pow-v1:";
// 默认难度：50000 在主流设备上约 1-3 秒可解出，兼顾防滥用与交互体验
const DEFAULT_ALTCHA_DIFFICULTY = 50_000;

export interface ChallengeServerConfig {
  provider: ChallengeProvider;
  scope: ChallengeScope;
  altchaDifficulty: number;
  turnstile: {
    enabled: boolean;
    siteKey: string;
    secretKey: string;
  };
  fallback: {
    maxFailures: number;
    timeoutMs: number;
  };
}

export interface ChallengeClientConfig {
  provider: ChallengeProvider;
  scope: ChallengeScope;
  siteKey: string;
  difficulty: number;
  fallback: {
    maxFailures: number;
    timeoutMs: number;
  };
}

export interface ChallengeVerification {
  ok: boolean;
  reason?: "missing" | "invalid" | "used" | "error";
}

/** 从主密钥派生 ALTCHA HMAC 密钥，避免额外依赖环境变量。 */
export function getAltchaSecret(env: Env): string {
  return `${ALTCHA_SECRET_PREFIX}${env.BETTER_AUTH_SECRET}`;
}

export async function getChallengeServerConfig(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<ChallengeServerConfig> {
  const config = await ConfigService.getSystemConfig(context);
  const challenge = ConfigService.resolveChallengeConfig(config);
  return {
    provider: challenge.provider,
    scope: challenge.scope,
    altchaDifficulty: challenge.altcha.difficulty ?? DEFAULT_ALTCHA_DIFFICULTY,
    turnstile: {
      enabled: challenge.turnstile.enabled,
      siteKey: challenge.turnstile.siteKey ?? "",
      secretKey: challenge.turnstile.secretKey ?? "",
    },
    fallback: {
      maxFailures: challenge.turnstile.fallback.maxFailures ?? 3,
      timeoutMs: challenge.turnstile.fallback.timeoutMs ?? 30000,
    },
  };
}

export async function getChallengeClientConfig(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<ChallengeClientConfig> {
  const server = await getChallengeServerConfig(context);
  return {
    provider: server.provider,
    scope: server.scope,
    siteKey: server.turnstile.siteKey,
    difficulty: server.altchaDifficulty,
    fallback: server.fallback,
  };
}

/**
 * provider 是否真正可执行：
 * - altcha 自托管，永远 ready（密钥派生自 BETTER_AUTH_SECRET）
 * - turnstile 需要同时有 siteKey / secretKey
 */
export function isChallengeReady(config: ChallengeServerConfig): boolean {
  if (config.provider === "altcha") return true;
  if (config.provider === "turnstile") {
    return (
      !!config.turnstile.enabled &&
      !!config.turnstile.siteKey &&
      !!config.turnstile.secretKey
    );
  }
  return false;
}

/** 是否开启了「保护全站」且挑战可执行。 */
export function isFullSiteChallengeEnabled(
  config: ChallengeServerConfig,
): boolean {
  return config.scope === "full-site" && isChallengeReady(config);
}

/** 生成一次性、带 TTL 的 ALTCHA challenge（base64 payload）。 */
export function createAltchaChallengePayload(
  env: Env,
  difficulty?: number,
): string {
  const challenge = createAltchaChallenge({
    maxNumber: difficulty ?? DEFAULT_ALTCHA_DIFFICULTY,
    secret: getAltchaSecret(env),
  });
  return encodeBase64Json(challenge);
}

function usedChallengeKey(challenge: string): string {
  return `challenge:used:${challenge}`;
}

/**
 * 校验 ALTCHA PoW 解并标记一次性（replay-guarded）。
 *
 * 防重放同时落在 D1（权威，始终可用）与 KV（快路径，经写入保护层）。
 * 全部失败时宽容放行，避免把人挡在门外。
 */
export async function verifyAltchaSolutionPayload(
  env: Env,
  payloadBase64: string,
): Promise<ChallengeVerification> {
  const solution = parseAltchaSolution(payloadBase64);
  if (!solution) {
    return { ok: false, reason: "invalid" };
  }

  const secret = getAltchaSecret(env);
  if (!verifyAltchaSolution(solution, secret)) {
    return { ok: false, reason: "invalid" };
  }

  const key = usedChallengeKey(solution.challenge);
  const challenge = solution.challenge;

  // 1) KV 快路径：已用则拒绝
  try {
    const existing = await env.KV.get(key);
    if (existing !== null) {
      return { ok: false, reason: "used" };
    }
  } catch {
    // KV 不可用则忽略，继续走 D1
  }

  // 2) D1 权威去重：insert onConflictDoNothing 保证同 challenge 仅首次成功
  try {
    const db = getDb(env);
    const inserted = await db
      .insert(UsedChallengesTable)
      .values({ challenge })
      .onConflictDoNothing()
      .run();
    if (inserted.meta.changes === 0) {
      return { ok: false, reason: "used" };
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        message: "challenge replay guard D1 insert failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return { ok: true, reason: "error" };
  }

  // 3) 尽力写 KV（经保护层，失败不影响——D1 已是权威防重放源）
  await guardedKvPut(env, key, "1", {
    expirationTtl: ALTCHA_CHALLENGE_TTL_SECONDS,
  });

  return { ok: true };
}
