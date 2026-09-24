import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AUTH_KEYS } from "@/features/auth/queries";
import { requestSendOtp } from "@/features/email-otp/client/otp.client";
import { OTP_RESEND_COOLDOWN_SECONDS } from "@/features/email-otp/otp-constants";
import { usePreviousLocation } from "@/hooks/use-previous-location";
import { authClient } from "@/lib/auth/auth.client";
import { getOtpSendErrorMessage, getRegisterAuthErrorMessage } from "@/lib/auth/auth-errors";
import type { Messages } from "@/lib/i18n";
import { m } from "@/paraglide/messages";

const OTP_CODE_PATTERN = /^\d{6}$/;

const createRegisterSchema = (messages: Messages) =>
  z
    .object({
      name: z
        .string()
        .min(2, messages.register_validation_name_min())
        .max(20, messages.register_validation_name_max()),
      email: z.email(messages.register_validation_email_invalid()),
      password: z.string().min(8, messages.register_validation_password_min()),
      confirmPassword: z.string(),
      otp: z.string().optional(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: messages.register_validation_password_mismatch(),
      path: ["confirmPassword"],
    });

type RegisterSchema = z.infer<ReturnType<typeof createRegisterSchema>>;

export interface UseRegisterFormOptions {
  isEmailConfigured: boolean;
}

export function useRegisterForm(options: UseRegisterFormOptions) {
  const { isEmailConfigured } = options;

  const [step, setStep] = useState<"IDLE" | "OTP" | "VERIFYING" | "SUCCESS">(
    "IDLE",
  );
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();
  const previousLocation = usePreviousLocation();
  const queryClient = useQueryClient();
  const registerSchema = createRegisterSchema(m);

  const form = useForm<RegisterSchema>({
    resolver: standardSchemaResolver(registerSchema),
  });

  // 重发冷却倒计时
  useEffect(() => {
    if (resendSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setResendSecondsLeft((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSecondsLeft]);

  const handleSendCode = async (data: RegisterSchema): Promise<void> => {
    const result = await requestSendOtp({
      email: data.email,
      purpose: "register",
    });

    if (!result.ok) {
      setStep("IDLE");
      const description =
        getOtpSendErrorMessage(result, m) ?? m.register_error_default();
      toast.error(m.otp_toast_send_failed(), { description });
      return;
    }

    setOtpEmail(data.email.toLowerCase());
    setResendSecondsLeft(OTP_RESEND_COOLDOWN_SECONDS);
    setStep("OTP");
    form.setValue("otp", "");
    toast.success(m.otp_toast_sent(), { description: m.otp_toast_sent_desc() });
  };

  const handleVerify = async (data: RegisterSchema): Promise<void> => {
    const code = data.otp?.trim() ?? "";
    if (!OTP_CODE_PATTERN.test(code)) {
      form.setError("otp", {
        type: "manual",
        message: m.otp_code_invalid_format(),
      });
      return;
    }
    setStep("VERIFYING");

    const { error } = await authClient.signUp.email({
      email: data.email,
      password: data.password,
      name: data.name,
      callbackURL: `${window.location.origin}/verify-email`,
      fetchOptions: {
        headers: {
          "X-Otp": code,
        },
      },
    });

    if (error) {
      // 验证码一次性：失败或过期时回到输入态，重新获取后再试
      setStep("OTP");
      toast.error(m.register_toast_failed(), {
        description:
          getRegisterAuthErrorMessage(error, m) ?? m.register_error_default(),
      });
      return;
    }

    queryClient.removeQueries({ queryKey: AUTH_KEYS.session });
    setIsSuccess(true);
    setStep("SUCCESS");

    setTimeout(() => {
      if (isEmailConfigured) {
        toast.success(m.register_toast_success(), {
          description: m.register_toast_activated(),
        });
      }
      navigate({ to: previousLocation });
    }, 800);
  };

  const onSubmit = (data: RegisterSchema) => {
    if (step === "OTP") return handleVerify(data);
    return handleSendCode(data);
  };

  const handleResendCode = async () => {
    if (resendSecondsLeft > 0) return;
    const data = form.getValues();
    await handleSendCode(data);
  };

  const handleBackToCredentials = () => {
    setStep("IDLE");
    setOtpEmail(null);
    setResendSecondsLeft(0);
    form.setValue("otp", "");
    form.clearErrors("otp");
  };

  return {
    register: form.register,
    errors: form.formState.errors,
    handleSubmit: form.handleSubmit(onSubmit),
    isSubmitting: form.formState.isSubmitting,
    isSuccess,
    registerStep: step,
    otpEmail,
    resendSecondsLeft,
    handleResendCode,
    handleBackToCredentials,
  };
}

export type UseRegisterFormReturn = ReturnType<typeof useRegisterForm>;