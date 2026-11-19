import { Loader2, ShieldCheck } from "lucide-react";
import { Turnstile as WidgetTurnstile } from "@/components/common/turnstile";
import type { UseChallengeReturn } from "@/features/challenge/hooks/use-challenge";
import { m } from "@/paraglide/messages";

interface ChallengeWidgetProps {
  useChallengeInstance: UseChallengeReturn;
}

export function ChallengeWidget({
  useChallengeInstance,
}: ChallengeWidgetProps) {
  const c = useChallengeInstance;
  const { mode, altchaFailed, reset, turnstileProps } = c;

  if (!c.active) return null;

  if (mode === "turnstile") {
    return (
      <div className={c.verified ? "hidden" : "flex justify-center"}>
        <div className="w-full min-w-[300px] max-w-sm">
          <TurnstileInner turnstileProps={turnstileProps} />
        </div>
      </div>
    );
  }

  if (c.verified) return null;

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
  turnstileProps: UseChallengeReturn["turnstileProps"];
}) {
  return <WidgetTurnstile {...turnstileProps} />;
}
