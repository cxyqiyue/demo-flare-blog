import { Loader2, ShieldCheck } from "lucide-react";
import { Turnstile as WidgetTurnstile } from "@/components/common/turnstile";
import {
  useChallenge,
  type UseChallengeReturn,
} from "@/features/challenge/hooks/use-challenge";
import { m } from "@/paraglide/messages";

interface ChallengeWidgetProps {
  action: string;
  /** 从服务端下发的 challenge 客户端配置 */
  challenge: Parameters<typeof useChallenge>[0]["config"];
  /**
   * 可选的受控实例。传入后使用同一实例，避免页面与组件各自维护
   * 一份验证状态（例如表单提交依赖的 challengePending 与 UI 展示不一致）。
   */
  useChallengeInstance?: UseChallengeReturn;
}

export function ChallengeWidget({
  action,
  challenge,
  useChallengeInstance,
}: ChallengeWidgetProps) {
  const internal = useChallenge({ action, config: challenge });
  const c = useChallengeInstance ?? internal;
  const { mode, altchaFailed, reset, turnstileProps } = c;

  if (!c.active) return null;

  // 验证通过后整个卡片隐藏，界面恢复为未开启人机验证时的样子
  if (c.verified) return null;

  if (mode === "turnstile") {
    return (
      <div className="flex justify-center">
        <div className="w-full max-w-sm rounded-md border border-border/30 bg-background/80 px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/30 bg-muted/30"
              aria-hidden
            >
              <Loader2
                size={18}
                className="animate-spin text-muted-foreground"
              />
            </span>
            <div className="min-w-0 space-y-0.5 text-left">
              <p className="text-sm font-medium text-foreground">
                {m.challenge_turnstile_verifying()}
              </p>
              <p className="text-xs text-muted-foreground">
                {m.challenge_turnstile_verifying_desc()}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <TurnstileInner turnstileProps={turnstileProps} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-sm rounded-md border border-border/30 bg-background/80 px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/30 bg-muted/30"
            aria-hidden
          >
            {altchaFailed ? (
              <ShieldCheck size={18} className="text-destructive" />
            ) : (
              <Loader2
                size={18}
                className="animate-spin text-muted-foreground"
              />
            )}
          </span>
          <div className="min-w-0 space-y-0.5 text-left">
            {altchaFailed ? (
              <>
                <p className="text-sm font-medium text-foreground">
                  {m.challenge_altcha_error()}
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  {m.challenge_altcha_retry()}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  {m.challenge_altcha_verifying()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.challenge_altcha_verifying_desc()}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TurnstileInner({
  turnstileProps,
}: {
  turnstileProps: ReturnType<typeof useChallenge>["turnstileProps"];
}) {
  return <WidgetTurnstile {...turnstileProps} />;
}
