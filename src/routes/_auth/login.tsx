import {
  createFileRoute,
  useLocation,
  useRouteContext,
} from "@tanstack/react-router";
import theme from "@theme";
import { z } from "zod";
import { useLoginForm, useSocialLogin } from "@/features/auth/hooks";
import { ChallengeWidget } from "@/features/challenge/components/challenge-widget";
import { useChallenge } from "@/features/challenge/hooks/use-challenge";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/login")({
  validateSearch: z.object({
    redirectTo: z.string().optional(),
  }),
  component: RouteComponent,
  head: () => ({
    meta: [
      {
        title: m.login_title(),
      },
    ],
  }),
});

function RouteComponent() {
  const { isEmailConfigured, challengeConfig } = useRouteContext({
    from: "/_auth",
  });
  const search = Route.useSearch();
  const location = useLocation();
  const challenge = useChallenge({ action: "login", config: challengeConfig });

  const currentSearchParams = new URLSearchParams(location.searchStr);
  const isOAuthAuthorizationRequest =
    !!currentSearchParams.get("client_id") &&
    !!currentSearchParams.get("response_type");

  let resolvedRedirectTo = search.redirectTo;
  if (!resolvedRedirectTo && isOAuthAuthorizationRequest) {
    resolvedRedirectTo = `/oauth/consent?${currentSearchParams.toString()}`;
  }

  const loginForm = useLoginForm({
    challenge,
    redirectTo: resolvedRedirectTo,
  });

  const socialLogin = useSocialLogin({
    redirectTo: resolvedRedirectTo,
    challenge,
  });

  const challengeElement =
    challengeConfig.provider !== "none" ? (
      <ChallengeWidget
        action="login"
        challenge={challengeConfig}
        useChallengeInstance={challenge}
      />
    ) : null;

  return (
    <theme.LoginPage
      isEmailConfigured={isEmailConfigured}
      loginForm={{
        ...loginForm,
        challengePending: challenge.isPending,
      }}
      socialLogin={socialLogin}
      challengeElement={challengeElement}
    />
  );
}
