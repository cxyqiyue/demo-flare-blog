import {
  createFileRoute,
  redirect,
  useRouteContext,
} from "@tanstack/react-router";
import theme from "@theme";
import { Turnstile, useTurnstile } from "@/components/common/turnstile";
import { useRegisterForm } from "@/features/auth/hooks";
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
  const { isEmailConfigured, turnstileConfig } = useRouteContext({
    from: "/_auth",
  });
  const turnstileSiteKey = turnstileConfig.enabled
    ? turnstileConfig.siteKey
    : "";
  const {
    isPending: turnstilePending,
    token: turnstileToken,
    reset: resetTurnstile,
    turnstileProps,
  } = useTurnstile("register", turnstileSiteKey);

  const registerForm = useRegisterForm({
    turnstileToken,
    turnstilePending,
    resetTurnstile,
    isEmailConfigured,
  });

  const turnstileElement = turnstileConfig.enabled ? (
    <div className="flex justify-center">
      <Turnstile {...turnstileProps} />
    </div>
  ) : null;

  return (
    <theme.RegisterPage
      isEmailConfigured={isEmailConfigured}
      registerForm={{ ...registerForm, turnstileProps }}
      turnstileElement={turnstileElement}
    />
  );
}
