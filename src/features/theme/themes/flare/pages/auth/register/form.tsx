import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { RegisterFormData } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";

interface RegisterFormProps {
  form: RegisterFormData;
}

export function RegisterForm({ form }: RegisterFormProps) {
  const {
    register,
    errors,
    handleSubmit,
    isSubmitting,
    registerStep,
    otpEmail,
    resendSecondsLeft,
    handleResendCode,
    handleBackToCredentials,
  } = form;

  const isIdle = registerStep === "IDLE";

  const inputClassName =
    "h-11 rounded-lg border border-border/60 bg-background/60 px-3 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-border";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isIdle ? (
        <>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/90">
                {m.register_nickname()}
              </label>
              <Input
                type="text"
                {...register("name")}
                className={inputClassName}
                placeholder={m.register_nickname_placeholder()}
                disabled={isSubmitting}
              />
              {errors.name && (
                <span className="text-xs text-destructive block">
                  {errors.name.message}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/90">
                {m.login_email_address()}
              </label>
              <Input
                type="email"
                {...register("email")}
                className={inputClassName}
                placeholder={m.login_email_placeholder()}
                disabled={isSubmitting}
              />
              {errors.email && (
                <span className="text-xs text-destructive block">
                  {errors.email.message}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/90">
                  {m.register_password()}
                </label>
                <Input
                  type="password"
                  {...register("password")}
                  className={inputClassName}
                  placeholder={m.login_password_placeholder()}
                  disabled={isSubmitting}
                />
                {errors.password && (
                  <span className="text-xs text-destructive block">
                    {errors.password.message}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/90">
                  {m.register_confirm_password()}
                </label>
                <Input
                  type="password"
                  {...register("confirmPassword")}
                  className={inputClassName}
                  placeholder={m.login_password_placeholder()}
                  disabled={isSubmitting}
                />
                {errors.confirmPassword && (
                  <span className="text-xs text-destructive block">
                    {errors.confirmPassword.message}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <span>{m.otp_send_code()}</span>
            )}
          </button>
        </>
      ) : (
        <>
          <div className="space-y-2 text-center rounded-xl border border-border/50 bg-background/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {m.register_label()}
            </p>
            <p className="text-sm text-muted-foreground leading-6">
              {m.otp_desc_register({ email: otpEmail ?? "" })}
            </p>
            <p className="text-xs text-muted-foreground/80">
              {m.otp_expires_hint()}
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="register-otp"
              className="text-sm font-medium text-foreground/90"
            >
              {m.otp_code_label()}
            </label>
            <Input
              id="register-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              {...register("otp")}
              className="h-12 rounded-lg border border-border/60 bg-background/60 px-3 text-center text-lg font-mono tracking-[0.4em] shadow-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-border"
              placeholder="000000"
              disabled={isSubmitting || registerStep === "SUCCESS"}
            />
            {errors.otp && (
              <span className="text-xs text-destructive block">
                {errors.otp.message}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || registerStep === "SUCCESS"}
            className="w-full h-11 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {registerStep === "VERIFYING" || isSubmitting ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <span>{m.otp_verify_submit_register()}</span>
            )}
          </button>

          <div className="flex justify-between items-center text-xs">
            <button
              type="button"
              onClick={handleBackToCredentials}
              disabled={isSubmitting || registerStep === "SUCCESS"}
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
                registerStep === "SUCCESS"
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
