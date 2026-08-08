import { createFileRoute, redirect } from "@tanstack/react-router";
import theme from "@theme";
import { useForgotPasswordForm } from "@/features/auth/hooks";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/forgot-password")({
  beforeLoad: ({ context }) => {
    if (!context.isEmailConfigured) {
      throw redirect({ to: "/login" });
    }
  },
  component: RouteComponent,
  head: () => ({
    meta: [
      {
        title: m.forgot_password_title(),
      },
    ],
  }),
});

function RouteComponent() {
  const forgotPasswordForm = useForgotPasswordForm();

  return <theme.ForgotPasswordPage forgotPasswordForm={forgotPasswordForm} />;
}
