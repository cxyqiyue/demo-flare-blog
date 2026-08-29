import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Turnstile as WidgetTurnstile } from "@/components/common/turnstile";
import { useChallenge } from "@/features/challenge/hooks/use-challenge";
import { challengeConfigQuery } from "@/features/challenge/queries";
import type { ChallengeClientConfig } from "@/features/challenge/service/challenge.service";
import { m } from "@/paraglide/messages";

const FULLSITE_VERIFY_URL = "/api/challenge/fullsite/verify";

/**
 * 全站人机验证遮罩：全屏毛玻璃叠加层，覆盖前台正文。
 * - 验证通过后签发通行证 cookie，并「整体」卸载遮罩露出正文。
 *   注意：不能只隐藏内层验证卡片——外层毛玻璃容器必须一并卸载，
 *   否则会留下一层空的 backdrop-blur 挡住并模糊整个页面。
 * - 验证请求失败/配置拉取失败时展示内联错误与重试，而不是静默隐藏
 *   （缺 cookie 时后续导航会反复弹层，体验反而更差）。
 * - 仅当前台被锁定（未验证访客访问受保护页）时由布局挂载。
 */
export function FullSiteGateOverlay() {
  const {
    data: challengeConfig,
    refetch: refetchConfig,
    isError: configError,
  } = useQuery(challengeConfigQuery);
  // 验证通过后的解锁态维持在当前组件生命周期内：在没有浏览器刷新离开页面之前，
  // 即使路由 loader 中的 fullSiteLocked 仍为旧值，遮罩也不会再次出现；
  // 后续 SPA 导航 / 整页刷新会由 beforeLoad 重新读取通行证 cookie，二者最终一致。
  const [unlocked, setUnlocked] = useState(false);

  if (unlocked) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background/60 p-4 backdrop-blur-xl"
      aria-live="polite"
    >
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border/40 bg-background/80 px-6 py-6 shadow-xl">
          <p className="text-center text-sm font-medium leading-relaxed text-foreground">
            {m.challenge_full_site_desc()}
          </p>

          <div className="mt-5 flex justify-center">
            {configError ? (
              <VerifyError onRetry={() => void refetchConfig()} />
            ) : challengeConfig ? (
              <GateChallenge
                config={challengeConfig}
                onVerified={() => setUnlocked(true)}
              />
            ) : (
              <Loader2
                size={18}
                className="animate-spin text-muted-foreground"
                aria-hidden
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VerifyError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-destructive">{m.challenge_altcha_error()}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        {m.challenge_altcha_retry()}
      </button>
    </div>
  );
}

function GateChallenge({
  config,
  onVerified,
}: {
  config: ChallengeClientConfig;
  onVerified: () => void;
}) {
  const [verifyFailed, setVerifyFailed] = useState(false);
  const verifiedHandled = useRef(false);

  const challenge = useChallenge({ action: "fullsite", config });

  const { verified, token, altchaSolution } = challenge;

  useEffect(() => {
    if (!verified || verifiedHandled.current) return;
    verifiedHandled.current = true;

    void (async () => {
      const headers: HeadersInit = {};
      if (token) {
        headers["X-Turnstile-Token"] = token;
      } else if (altchaSolution) {
        headers["X-Altcha-Solution"] = altchaSolution;
      }

      try {
        const res = await fetch(FULLSITE_VERIFY_URL, {
          method: "POST",
          credentials: "same-origin",
          headers,
          body: "{}",
        });
        if (res.ok) {
          onVerified();
          return;
        }
      } catch {
        // 网络异常：走到下方失败态，允许用户重试
      }

      setVerifyFailed(true);
    })();
  }, [verified, token, altchaSolution, onVerified]);

  if (verifyFailed) {
    return (
      <VerifyError
        onRetry={() => {
          setVerifyFailed(false);
          verifiedHandled.current = false;
          challenge.reset();
        }}
      />
    );
  }

  if (challenge.mode === "turnstile") {
    return <WidgetTurnstile {...challenge.turnstileProps} />;
  }

  if (challenge.altchaFailed) {
    return <VerifyError onRetry={challenge.reset} />;
  }

  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Loader2 size={15} className="animate-spin" aria-hidden />
      <p className="text-xs">{m.challenge_altcha_verifying()}</p>
    </div>
  );
}
