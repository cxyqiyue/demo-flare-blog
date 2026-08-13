import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AUTH_KEYS } from "@/features/auth/queries";
import type { UseChallengeReturn } from "@/features/challenge/hooks/use-challenge";
import { usePreviousLocation } from "@/hooks/use-previous-location";
import { authClient } from "@/lib/auth/auth.client";
import { getRegisterAuthErrorMessage } from "@/lib/auth/auth-errors";
import type { Messages } from "@/lib/i18n";
import { m } from "@/paraglide/messages";

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
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: messages.register_validation_password_mismatch(),
      path: ["confirmPassword"],
    });

type RegisterSchema = z.infer<ReturnType<typeof createRegisterSchema>>;

export interface UseRegisterFormOptions {
  challenge: UseChallengeReturn;
  isEmailConfigured: boolean;
}

export function useRegisterForm(options: UseRegisterFormOptions) {
  const { challenge, isEmailConfigured } = options;

  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();
  const previousLocation = usePreviousLocation();
  const queryClient = useQueryClient();
  const registerSchema = createRegisterSchema(m);

  const form = useForm<RegisterSchema>({
    resolver: standardSchemaResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterSchema) => {
    if (challenge.isPending) {
      toast.error(m.challenge_pending_hint());
      return;
    }
    const { error } = await authClient.signUp.email({
      email: data.email,
      password: data.password,
      name: data.name,
      callbackURL: `${window.location.origin}/verify-email`,
      fetchOptions: {
        headers: {
          "X-Turnstile-Token": challenge.token || "",
          "X-Altcha-Solution": challenge.altchaSolution || "",
        },
      },
    });

    if (error) {
      // token 一次性：失败时重置，重新验证后再重试
      challenge.reset();
      toast.error(m.register_toast_failed(), {
        description:
          getRegisterAuthErrorMessage(error, m) ?? m.register_error_default(),
      });
      return;
    }

    queryClient.removeQueries({ queryKey: AUTH_KEYS.session });

    if (isEmailConfigured) {
      setIsSuccess(true);
      toast.success(m.register_toast_created(), {
        description: m.register_toast_verification_sent(),
      });
    } else {
      toast.success(m.register_toast_success(), {
        description: m.register_toast_activated(),
      });
      navigate({ to: previousLocation });
    }
  };

  return {
    register: form.register,
    errors: form.formState.errors,
    handleSubmit: form.handleSubmit(onSubmit),
    isSubmitting: form.formState.isSubmitting,
    isSuccess,
  };
}

export type UseRegisterFormReturn = ReturnType<typeof useRegisterForm>;
