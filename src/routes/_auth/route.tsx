import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import theme from "@theme";
import { emailConfiguredQuery, sessionQuery } from "@/features/auth/queries";
import { turnstileConfigQuery } from "@/features/turnstile/queries";
import { useNavigateBack } from "@/hooks/use-navigate-back";
import { CACHE_CONTROL } from "@/lib/constants";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.fetchQuery(sessionQuery);
    const isEmailConfigured =
      await context.queryClient.fetchQuery(emailConfiguredQuery);
    const turnstileConfig =
      await context.queryClient.fetchQuery(turnstileConfigQuery);

    if (session && !location.pathname.includes("verify-email")) {
      throw redirect({ to: "/" });
    }

    return { session, isEmailConfigured, turnstileConfig };
  },
  component: RouteComponent,
  headers: () => {
    return CACHE_CONTROL.private;
  },
});

function RouteComponent() {
  const navigateBack = useNavigateBack();
  return (
    <>
      <theme.AuthLayout onBack={navigateBack}>
        <Outlet />
      </theme.AuthLayout>
      <theme.Toaster />
    </>
  );
}
