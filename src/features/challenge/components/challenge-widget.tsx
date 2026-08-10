import { Check, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Turnstile as WidgetTurnstile } from "@/components/common/turnstile";
import { useChallenge } from "@/features/challenge/hooks/use-challenge";
import { m } from "@/paraglide/messages";

interface ChallengeWidgetProps {
  action: string;
  challenge: Parameters<typeof useChallenge>[0]["config"];
}

export function ChallengeWidget({ action, challenge }: ChallengeWidgetProps) {
  const {
    mode,
    isPending,
    altchaSolution,
    altchaFailed,
    reset,
    turnstileProps,
  } = useChallenge({ action, config: challenge });

  if (challenge.provider === "none" || mode === "none") return null;

  if (mode === "turnstile") {
    return (
      <div className="flex justify-center">
        <TurnstileInner turnstileProps={turnstileProps} />
      </div>
    );
  }

  const verified = !!altchaSolution;

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-sm rounded-md border border-border/30 bg-background/80 px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/30 bg-muted/30"
            aria-hidden
          >
            {verified ? (
              <Check size={18} className="text-emerald-500" />
            ) : altchaFailed ? (
              <ShieldCheck size={18} className="text-destructive" />
            ) : isPending ? (
              <Loader2
                size={18}
                className="animate-spin text-muted-foreground"
              />
            ) : (
              <Sparkles size={18} className="text-muted-foreground" />
            )}
          </span>
          <div className="min-w-0 space-y-0.5 text-left">
            {verified ? (
              <p className="text-sm font-medium text-foreground">
                {m.challenge_altcha_verified()}
              </p>
            ) : altchaFailed ? (
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
