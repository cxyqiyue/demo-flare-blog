import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AUTH_KEYS } from "@/features/auth/queries";
import type { UseChallengeReturn } from "@/features/challenge/hooks/use-challenge";
import { requestSendOtp } from "@/features/email-otp/client/otp.client";
import { OTP_RESEND_COOLDOWN_SECONDS } from "@/features/email-otp/otp-constants";
import { usePreviousLocation } from "@/hooks/use-previous-location";
import { authClient } from "@/lib/auth/auth.client";
import {
  getLoginAuthErrorMessage,
  getOtpSendErrorMessage,
  isEmailNotVerifiedError,
} from "@/lib/auth/auth-errors";
import type { Messages } from "@/lib/i18n";
import { m } from "@/paraglide/messages";
import { normalizeRedirectUrl } from "./normalize-redirect-url";

const OTP_CODE_PATTERN = /^\d{6}$/;

const createLoginSchema = (messages: Messages) =>
  z.object({
    email: z.email(messages.login_validation_invalid_email()),
    password: z.string().min(1, messages.login_validation_password_required()),
    otp: z.string().optional(),
  });

type LoginSchema = z.infer<ReturnType<typeof createLoginSchema>>;

export interface UseLoginFormOptions {
  challenge: UseChallengeReturn;
  redirectTo?: string;
}

export function useLoginForm(options: UseLoginFormOptions) {
  const { challenge, redirectTo } = options;

  const [loginStep, setLoginStep] = useState<
    "IDLE" | "OTP" | "VERIFYING" | "SUCCESS"
  >("IDLE");
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);

  const navigate = useNavigate();
  const previousLocation = usePreviousLocation();
  const queryClient = useQueryClient();
  const loginSchema = createLoginSchema(m);

  const form = useForm<LoginSchema>({
    resolver: standardSchemaResolver(loginSchema),
  });

  // 重发冷却倒计时
  useEffect(() => {
    if (resendSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setResendSecondsLeft((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSecondsLeft]);

  const performRedirect = (
    redirectTarget: string | undefined,
    fallback: string,
  ) => {
    const target = normalizeRedirectUrl(redirectTarget, fallback);

    if (target.startsWith("/api/")) {
      window.location.assign(target);
      return;
    }

    if (target.startsWith(window.location.origin)) {
      const url = new URL(target);
      navigate({ to: `${url.pathname}${url.search}${url.hash}` });
      return;
    }

    window.location.assign(target);
  };

  const emailValue = form.watch("email");
  const latestResendStateRef = useRef({
    emailValue,
    challenge,
  });

  latestResendStateRef.current = {
    emailValue,
    challenge,
  };

  const handleSendCode = async (data: LoginSchema): Promise<void> => {
    setLoginStep("IDLE");
    const result = await requestSendOtp({
      email: data.email,
      purpose: "login",
      password: data.password,
    });

    if (!result.ok) {
      const description =
        getOtpSendErrorMessage(result, m) ?? m.auth_error_default_desc();
      toast.error(m.otp_toast_send_failed(), { description });
      return;
    }

    setOtpEmail(data.email.toLowerCase());
    setResendSecondsLeft(OTP_RESEND_COOLDOWN_SECONDS);
    setLoginStep("OTP");
    form.setValue("otp", "");
    toast.success(m.otp_toast_sent(), { description: m.otp_toast_sent_desc() });
  };

  const handleVerify = async (data: LoginSchema): Promise<void> => {
    const code = data.otp?.trim() ?? "";
    if (!OTP_CODE_PATTERN.test(code)) {
      form.setError("otp", {
        type: "manual",
        message: m.otp_code_invalid_format(),
      });
      return;
    }
    setLoginStep("VERIFYING");

    const { error } = await authClient.signIn.email({
      email: data.email,
      password: data.password,
      fetchOptions: {
        headers: {
          "X-Otp": code,
        },
      },
    });

    if (error) {
      // 验证码一次性：失败或过期时回到输入态，重新获取后再试
      setLoginStep("OTP");
      const description =
        getLoginAuthErrorMessage(error, m) ?? m.auth_error_default_desc();

      toast.error(m.login_error_default(), {
        description,
        action: isEmailNotVerifiedError(error)
          ? {
              label: m.login_resend_verification(),
              onClick: () => {
                void handleResendVerification();
              },
            }
          : undefined,
      });
      return;
    }

    queryClient.removeQueries({ queryKey: AUTH_KEYS.session });
    setLoginStep("SUCCESS");

    setTimeout(() => {
      performRedirect(redirectTo, previousLocation);
      toast.success(m.login_toast_success());
    }, 800);
  };

  const onSubmit = (data: LoginSchema) => {
    if (loginStep === "OTP") return handleVerify(data);
    return handleSendCode(data);
  };

  const handleResendCode = async () => {
    if (resendSecondsLeft > 0) return;
    const data = form.getValues();
    await handleSendCode(data);
  };

  const handleBackToCredentials = () => {
    setLoginStep("IDLE");
    setOtpEmail(null);
    setResendSecondsLeft(0);
    form.setValue("otp", "");
    form.clearErrors("otp");
  };

  const handleResendVerification = async () => {
    const { emailValue: currentEmailValue, challenge: currentChallenge } =
      latestResendStateRef.current;

    if (!currentEmailValue) return;
    if (currentChallenge.isPending) {
      toast.error(m.login_toast_wait_turnstile());
      return;
    }

    const loadingToast = toast.loading(m.login_toast_sending_verification());

    const { error } = await authClient.sendVerificationEmail({
      email: currentEmailValue,
      callbackURL: `${window.location.origin}/verify-email`,
      fetchOptions: {
        headers: {
          "X-Turnstile-Token": currentChallenge.token || "",
          "X-Altcha-Solution": currentChallenge.altchaSolution || "",
        },
      },
    });

    currentChallenge.reset();
    toast.dismiss(loadingToast);

    if (error) {
      const description =
        getLoginAuthErrorMessage(error, m) ?? m.auth_error_default_desc();
      toast.error(m.login_toast_send_failed(), {
        description,
      });
      return;
    }

    toast.success(m.login_toast_verification_sent(), {
      description: m.login_toast_check_inbox(),
    });
  };

  return {
    register: form.register,
    errors: form.formState.errors,
    handleSubmit: form.handleSubmit(onSubmit),
    loginStep,
    isSubmitting: form.formState.isSubmitting,
    loginSchema,
    otpEmail,
    resendSecondsLeft,
    handleResendCode,
    handleBackToCredentials,
  };
}

export type UseLoginFormReturn = ReturnType<typeof useLoginForm>;