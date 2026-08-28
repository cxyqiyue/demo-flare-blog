import {
  createFileRoute,
  useNavigate,
  useRouteContext,
  useSearch,
} from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Turnstile as WidgetTurnstile } from "@/components/common/turnstile";
import { useChallenge } from "@/features/challenge/hooks/use-challenge";
import { challengeConfigQuery } from "@/features/challenge/queries";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/challenge")({
  beforeLoad: async ({ context }) => {
    const challengeConfig =
      await context.queryClient.fetchQuery(challengeConfigQuery);
    return { challengeConfig };
  },
  component: RouteComponent,
  head: () => ({
    meta: [{ title: m.challenge_full_site_title() }],
  }),
});

const FULLSITE_VERIFY_URL = "/api/challenge/fullsite/verify";

function RouteComponent() {
  const { challengeConfig } = useRouteContext({
    from: "/challenge",
  });
  const navigate = useNavigate();
  const search = useSearch({ from: "/challenge" }) as { redirect?: string };
  const redirect = search.redirect?.startsWith("/")
    ? search.redirect
    : undefined;

  const challenge = useChallenge({
    action: "fullsite",
    config: challengeConfig,
  });

  const [redirecting, setRedirecting] = useState(false);
  const verifiedHandled = useRef(false);

  // 验证通过后签发通行证 cookie，再跳回原目标页（仅一次）
  useEffect(() => {
    if (!challenge.verified || verifiedHandled.current) return;
    verifiedHandled.current = true;

    void (async () => {
      setRedirecting(true);
      const headers: HeadersInit = {};
      if (challenge.token) {
        headers["X-Turnstile-Token"] = challenge.token;
      } else if (challenge.altchaSolution) {
        headers["X-Altcha-Solution"] = challenge.altchaSolution;
      }

      try {
        await fetch(FULLSITE_VERIFY_URL, {
          method: "POST",
          credentials: "same-origin",
          headers,
          body: "{}",
        });
      } catch {
        // 网络异常也尝试跳转，服务端缺 cookie 时会再次引导验证
      }

      navigate({ to: redirect ?? "/" });
    })();
  }, [
    challenge.verified,
    challenge.token,
    challenge.altchaSolution,
    navigate,
    redirect,
  ]);

  return (
    <div className="default-theme min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center space-y-3">
          <div className="inline-flex items-center justify-center gap-2 rounded-full border border-border/30 bg-muted/30 px-4 py-2">
            <ShieldCheck size={14} className="text-muted-foreground" />
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-muted-foreground/70">
              {m.challenge_full_site_title()}
            </p>
          </div>
          <h1 className="text-xl font-serif font-medium tracking-tight">
            {m.challenge_full_site_desc()}
          </h1>
        </header>

        {redirecting ? (
          <div className="flex items-center justify-center gap-3 rounded-md border border-border/30 bg-background/80 p-6">
            <Loader2
              size={16}
              className="animate-spin text-muted-foreground"
            />
            <p className="text-sm text-muted-foreground">
              {m.challenge_full_site_redirecting()}
            </p>
          </div>
        ) : (
          <ChallengePanel challenge={challenge} />
        )}
      </div>
    </div>
  );
}

function ChallengePanel({
  challenge,
}: {
  challenge: ReturnType<typeof useChallenge>;
}) {
  const { mode, altchaFailed, reset, turnstileProps } = challenge;

  return (
    <div className="rounded-md border border-border/30 bg-background/80 px-5 py-4 shadow-sm">
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
                {mode === "turnstile"
                  ? m.challenge_turnstile_verifying()
                  : m.challenge_altcha_verifying()}
              </p>
              <p className="text-xs text-muted-foreground">
                {mode === "turnstile"
                  ? m.challenge_turnstile_verifying_desc()
                  : m.challenge_altcha_verifying_desc()}
              </p>
            </>
          )}
        </div>
      </div>

      {mode === "turnstile" && (
        <div className="mt-4 flex justify-center">
          <WidgetTurnstile {...turnstileProps} />
        </div>
      )}
    </div>
  );
}
