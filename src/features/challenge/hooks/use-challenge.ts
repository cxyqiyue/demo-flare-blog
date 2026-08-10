import { useCallback, useEffect, useRef, useState } from "react";
import {
  Turnstile,
  type TurnstileProps,
  useTurnstile,
} from "@/components/common/turnstile";
import { getAltchaChallengeFn } from "@/features/challenge/api/challenge.api";
import type { ChallengeClientConfig } from "@/features/challenge/service/challenge.service";

type ChallengeMode = "none" | "turnstile" | "altcha";

export interface UseChallengeOptions {
  action: string;
  config: ChallengeClientConfig;
}

interface SolverResult {
  type: "solution";
  payload: string;
}

/**
 * 统一人机验证 hook：
 * - provider = "turnstile"：走 Turnstile；连续失败达到 maxFailures 或超过 timeoutMs 未通过时，
 *   自动回退到 ALTCHA PoW（Web Worker 计算）。
 * - provider = "altcha"：直接走 ALTCHA PoW。
 * 返回的 token / altchaSolution 分别用于 X-Turnstile-Token / X-Altcha-Solution 请求头。
 */
export function useChallenge({ action, config }: UseChallengeOptions) {
  const baseTurnstile = useTurnstile(action, config.siteKey || undefined);
  const [mode, setMode] = useState<ChallengeMode>(
    config.provider === "altcha" ? "altcha" : config.provider,
  );
  const [altchaSolution, setAltchaSolution] = useState<string | null>(null);
  const [altchaFailed, setAltchaFailed] = useState(false);

  const failedCountRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("../pow/worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<SolverResult>) => {
      if (event.data.type === "solution") {
        if (mountedRef.current) {
          setAltchaSolution(event.data.payload);
        }
      }
    };
    workerRef.current = worker;
    return worker;
  }, []);

  const solveWithAltcha = useCallback(async () => {
    setAltchaSolution(null);
    try {
      const payload = await getAltchaChallengeFn();
      const worker = getWorker();
      worker.postMessage({ type: "work", payload });
    } catch {
      if (mountedRef.current) setAltchaFailed(true);
    }
  }, [getWorker]);

  // provider = "altcha" 时立即开始计算
  useEffect(() => {
    if (config.provider === "altcha") {
      void solveWithAltcha();
    }
  }, [config.provider, solveWithAltcha]);

  // provider = "turnstile" 时的超时兜底
  useEffect(() => {
    if (config.provider !== "turnstile") return;
    if (mode !== "turnstile") return;

    const timeoutId = setTimeout(() => {
      setMode("altcha");
      void solveWithAltcha();
    }, config.fallback.timeoutMs);

    return () => clearTimeout(timeoutId);
  }, [config.provider, mode, config.fallback.timeoutMs, solveWithAltcha]);

  const handleTurnstileError = useCallback(() => {
    failedCountRef.current += 1;
    if (failedCountRef.current >= config.fallback.maxFailures) {
      setMode("altcha");
      void solveWithAltcha();
    }
  }, [config.fallback.maxFailures, solveWithAltcha]);

  const handleTurnstileExpire = useCallback(() => {
    baseTurnstile.reset();
  }, [baseTurnstile]);

  const reset = useCallback(() => {
    setAltchaSolution(null);
    setAltchaFailed(false);
    failedCountRef.current = 0;
    baseTurnstile.reset();
    if (config.provider === "turnstile") {
      setMode("turnstile");
    } else if (config.provider === "altcha") {
      setMode("altcha");
      void solveWithAltcha();
    }
  }, [baseTurnstile, config.provider, solveWithAltcha]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const isPending =
    mode === "turnstile"
      ? baseTurnstile.isPending
      : mode === "altcha"
        ? !altchaSolution && !altchaFailed
        : false;

  return {
    mode,
    isPending,
    token: baseTurnstile.token,
    altchaSolution,
    altchaFailed,
    reset,
    turnstileProps: {
      ...baseTurnstile.turnstileProps,
      onError: handleTurnstileError,
      onExpire: handleTurnstileExpire,
    } satisfies TurnstileProps,
  };
}

export type UseChallengeReturn = ReturnType<typeof useChallenge>;
export { Turnstile };
