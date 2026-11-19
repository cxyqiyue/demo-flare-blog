import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { LoginFormData } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";

interface LoginFormProps {
  form: LoginFormData;
  isEmailConfigured: boolean;
}

export function LoginForm({ form, isEmailConfigured }: LoginFormProps) {
  const {
    register,
    errors,
    handleSubmit,
    loginStep,
    isSubmitting,
    challengePending,
    otpEmail,
    resendSecondsLeft,
    handleResendCode,
    handleBackToCredentials,
  } = form;

  const isIdle = loginStep === "IDLE";
  const otpLocked = !isIdle;

  const inputClassName =
    "h-11 rounded-lg border border-border/60 bg-background/60 px-3 text-base md:text-sm shadow-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-border";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isIdle ? (
        <>
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="login-email"
                className="text-sm font-medium text-foreground/90"
              >
                {m.login_email_address()}
              </label>
              <Input
                id="login-email"
                type="email"
                {...register("email")}
                className={inputClassName}
                placeholder={m.login_email_placeholder()}
                autoComplete="username"
                disabled={isSubmitting || otpLocked}
              />
              {errors.email && (
                <span className="text-xs text-destructive block">
                  {errors.email.message}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center gap-3">
                <label
                  htmlFor="login-password"
                  className="text-sm font-medium text-foreground/90"
                >
                  {m.login_password()}
                </label>
                {isEmailConfigured && (
                  <Link
                    to="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {m.login_forgot_password()}
                  </Link>
                )}
              </div>
              <Input
                id="login-password"
                type="password"
                {...register("password")}
                className={inputClassName}
                placeholder={m.login_password_placeholder()}
                autoComplete="current-password"
                disabled={isSubmitting || otpLocked}
              />
              {errors.password && (
                <span className="text-xs text-destructive block">
                  {errors.password.message}
                </span>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || resendSecondsLeft > 0 || challengePending}
            className="w-full h-11 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <span>
                {resendSecondsLeft > 0
                  ? m.otp_resend_in({ seconds: String(resendSecondsLeft) })
                  : m.otp_send_code()}
              </span>
            )}
          </button>
        </>
      ) : (
        <>
          <div className="space-y-2 text-center rounded-xl border border-border/50 bg-background/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {m.login_auth_label()}
            </p>
            <p className="text-sm text-muted-foreground leading-6">
              {m.otp_desc_login({ email: otpEmail ?? "" })}
            </p>
            <p className="text-xs text-muted-foreground/80">
              {m.otp_expires_hint()}
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="login-otp"
              className="text-sm font-medium text-foreground/90"
            >
              {m.otp_code_label()}
            </label>
            <Input
              id="login-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              {...register("otp")}
              className="h-12 rounded-lg border border-border/60 bg-background/60 px-3 text-center text-lg font-mono tracking-[0.4em] shadow-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-border"
              placeholder="••••••"
              disabled={isSubmitting || loginStep === "SUCCESS"}
            />
            {errors.otp && (
              <span className="text-xs text-destructive block">
                {errors.otp.message}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={
              isSubmitting || challengePending || loginStep === "SUCCESS"
            }
            className="w-full h-11 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loginStep === "VERIFYING" || isSubmitting ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <span>{m.otp_verify_submit_login()}</span>
            )}
          </button>

          <div className="flex justify-between items-center text-xs">
            <button
              type="button"
              onClick={handleBackToCredentials}
              disabled={isSubmitting || loginStep === "SUCCESS"}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              ← {m.otp_back()}
            </button>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={
                resendSecondsLeft > 0 ||
                isSubmitting ||
                challengePending ||
                loginStep === "SUCCESS"
              }
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {resendSecondsLeft > 0
                ? m.otp_resend_in({ seconds: String(resendSecondsLeft) })
                : m.otp_resend()}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
