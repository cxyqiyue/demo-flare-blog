import {
  createFileRoute,
  redirect,
  useRouteContext,
} from "@tanstack/react-router";
import theme from "@theme";
import { useRegisterForm } from "@/features/auth/hooks";
import { ChallengeWidget } from "@/features/challenge/components/challenge-widget";
import { useChallenge } from "@/features/challenge/hooks/use-challenge";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/register")({
  beforeLoad: ({ context }) => {
    if (!context.isEmailConfigured) {
      throw redirect({ to: "/login" });
    }
  },
  component: RouteComponent,
  head: () => ({
    meta: [
      {
        title: m.register_title(),
      },
    ],
  }),
});

function RouteComponent() {
  const { isEmailConfigured, challengeConfig } = useRouteContext({
    from: "/_auth",
  });
  const challenge = useChallenge({
    action: "register",
    config: challengeConfig,
  });

  const registerForm = useRegisterForm({
    challenge,
    isEmailConfigured,
  });

  const challengeElement =
    challengeConfig.provider !== "none" ? (
      <ChallengeWidget
        action="register"
        challenge={challengeConfig}
        useChallengeInstance={challenge}
      />
    ) : null;

  return (
    <theme.RegisterPage
      isEmailConfigured={isEmailConfigured}
      registerForm={{
        ...registerForm,
        challengePending: challenge.isPending,
      }}
      challengeElement={challengeElement}
    />
  );
}
