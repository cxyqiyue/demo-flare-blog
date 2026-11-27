import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/auth.client";
import { getLogoutAuthErrorMessage } from "@/lib/auth/auth-errors";
import { m } from "@/paraglide/messages";
import { runSessionTransition } from "../session-query-cache";
import { useSessionQueryCache } from "./use-session-query-cache";

export function useLogout(
  options: { redirectTo?: "/" | "/login"; admin?: boolean } = {},
) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  useSessionQueryCache();

  const logout = async () => {
    const { error } = await runSessionTransition(queryClient, () =>
      authClient.signOut(),
    );
    if (error) {
      toast.error(
        options.admin ? m.admin_sidebar_logout_failed() : m.auth_logout_failed(),
        {
          description: options.admin
            ? m.admin_sidebar_logout_failed_desc()
            : getLogoutAuthErrorMessage(error, m) ?? m.auth_logout_failed_desc(),
        },
      );
      return;
    }
    if (options.admin) toast.success(m.admin_sidebar_logout_success());
    else {
      toast.success(m.auth_logout_success(), {
        description: m.auth_logout_success_desc(),
      });
    }
    // Leave the rendered private content and invalidate cached route loaders.
    await navigate({ to: options.redirectTo ?? "/", replace: true });
    await router.invalidate();
  };

  return { logout };
}
