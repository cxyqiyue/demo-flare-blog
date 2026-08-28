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
 * - 验证通过后签发通行证 cookie，并自行关闭遮罩露出正文。
 * - 仅当前台被锁定（未验证访客访问受保护页）时由布局挂载。
 */
export function FullSiteGateOverlay() {
  const { data: challengeConfig } = useQuery(challengeConfigQuery);

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
            {challengeConfig ? (
              <GateChallenge config={challengeConfig} />
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

function GateChallenge({ config }: { config: ChallengeClientConfig }) {
  const [dismissed, setDismissed] = useState(false);
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
        await fetch(FULLSITE_VERIFY_URL, {
          method: "POST",
          credentials: "same-origin",
          headers,
          body: "{}",
        });
      } catch {
        // 网络异常时仍尝试关闭遮罩，缺 cookie 时下次进入会再次引导
      }

      setDismissed(true);
    })();
  }, [verified, token, altchaSolution]);

  if (dismissed) return null;

  if (challenge.mode === "turnstile") {
    return <WidgetTurnstile {...challenge.turnstileProps} />;
  }

  if (challenge.altchaFailed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-destructive">
          {m.challenge_altcha_error()}
        </p>
        <button
          type="button"
          onClick={challenge.reset}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {m.challenge_altcha_retry()}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Loader2 size={15} className="animate-spin" aria-hidden />
      <p className="text-xs">{m.challenge_altcha_verifying()}</p>
    </div>
  );
}
