import { useState } from "react";
import { toast } from "sonner";
import type { UseChallengeReturn } from "@/features/challenge/hooks/use-challenge";
import { usePreviousLocation } from "@/hooks/use-previous-location";
import { authClient } from "@/lib/auth/auth.client";
import { getSocialLoginAuthErrorMessage } from "@/lib/auth/auth-errors";
import { m } from "@/paraglide/messages";
import { normalizeRedirectUrl } from "./normalize-redirect-url";

export interface UseSocialLoginOptions {
  redirectTo?: string;
  /** 人机验证实例。验证未通过时禁止发起 OAuth 登录 */
  challenge?: UseChallengeReturn;
}

export function useSocialLogin(options: UseSocialLoginOptions) {
  const { redirectTo, challenge } = options;

  const [isLoading, setIsLoading] = useState(false);
  const previousLocation = usePreviousLocation();
  const callbackURL = normalizeRedirectUrl(redirectTo, previousLocation);

  const handleGithubLogin = async () => {
    if (isLoading) return;

    // 未通过人机验证前不允许发起 Github 登录
    if (challenge?.isPending) {
      toast.error(m.challenge_pending_hint());
      return;
    }

    setIsLoading(true);

    const { error } = await authClient.signIn.social({
      provider: "github",
      errorCallbackURL: `${window.location.origin}/login`,
      callbackURL,
    });

    if (error) {
      toast.error(m.login_toast_social_failed(), {
        description:
          getSocialLoginAuthErrorMessage(error, m) ??
          m.auth_error_default_desc(),
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
  };

  return {
    isLoading,
    handleGithubLogin,
    challengePending: challenge?.isPending ?? false,
  };
}

export type UseSocialLoginReturn = ReturnType<typeof useSocialLogin>;
