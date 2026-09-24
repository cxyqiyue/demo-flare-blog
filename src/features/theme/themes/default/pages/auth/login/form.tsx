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
    otpEmail,
    resendSecondsLeft,
    handleResendCode,
    handleBackToCredentials,
  } = form;

  const isIdle = loginStep === "IDLE";
  const otpLocked = !isIdle;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {isIdle ? (
        <>
          <div className="space-y-6">
            <div className="space-y-2 group">
              <label
                htmlFor="login-email"
                className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 group-focus-within:text-foreground transition-colors"
              >
                {m.login_email_address()}
              </label>
              <Input
                id="login-email"
                type="email"
                {...register("email")}
                className="w-full bg-transparent border-0 border-b border-border/40 rounded-none py-3 text-sm font-light focus-visible:ring-0 focus:border-foreground focus:outline-none transition-all placeholder:text-muted-foreground/30 shadow-none px-0"
                placeholder={m.login_email_placeholder()}
                autoComplete="username"
                disabled={isSubmitting || otpLocked}
              />
              {errors.email && (
                <span className="text-[9px] font-mono text-destructive uppercase tracking-widest mt-1 block">
                  {errors.email.message}
                </span>
              )}
            </div>

            <div className="space-y-2 group">
              <div className="flex justify-between items-center">
                <label
                  htmlFor="login-password"
                  className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 group-focus-within:text-foreground transition-colors"
                >
                  {m.login_password()}
                </label>
                {isEmailConfigured && (
                  <Link
                    to="/forgot-password"
                    tabIndex={-1}
                    className="text-[9px] font-mono text-muted-foreground/40 hover:text-foreground transition-colors"
                  >
                    [ {m.login_forgot_password()} ]
                  </Link>
                )}
              </div>
              <Input
                id="login-password"
                type="password"
                {...register("password")}
                className="w-full bg-transparent border-0 border-b border-border/40 rounded-none py-3 text-sm font-light focus-visible:ring-0 focus:border-foreground focus:outline-none transition-all placeholder:text-muted-foreground/30 shadow-none px-0"
                placeholder={m.login_password_placeholder()}
                autoComplete="current-password"
                disabled={isSubmitting || otpLocked}
              />
              {errors.password && (
                <span className="text-[9px] font-mono text-destructive uppercase tracking-widest mt-1 block">
                  {errors.password.message}
                </span>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-foreground text-background text-[10px] font-mono uppercase tracking-[0.3em] hover:opacity-80 transition-all disabled:opacity-30 flex items-center justify-center gap-3"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <span>{m.otp_send_code()}</span>
            )}
          </button>
        </>
      ) : (
        <>
          <div className="space-y-2 text-center">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
              [ {m.login_auth_label()} ]
            </p>
            <p className="text-xs text-muted-foreground/70 font-light leading-relaxed">
              {m.otp_desc_login({ email: otpEmail ?? "" })}
            </p>
            <p className="text-[9px] font-mono text-muted-foreground/40">
              {m.otp_expires_hint()}
            </p>
          </div>

          <div className="space-y-2 group">
            <label
              htmlFor="login-otp"
              className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 group-focus-within:text-foreground transition-colors"
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
              className="w-full bg-transparent border-0 border-b border-border/40 rounded-none py-3 text-center text-lg font-mono tracking-[0.5em] focus-visible:ring-0 focus:border-foreground focus:outline-none transition-all placeholder:text-muted-foreground/30 shadow-none px-0"
              placeholder="000000"
              disabled={isSubmitting || loginStep === "SUCCESS"}
            />
            {errors.otp && (
              <span className="text-[9px] font-mono text-destructive uppercase tracking-widest mt-1 block">
                {errors.otp.message}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={
              isSubmitting || loginStep === "SUCCESS"
            }
            className="w-full py-4 bg-foreground text-background text-[10px] font-mono uppercase tracking-[0.3em] hover:opacity-80 transition-all disabled:opacity-30 flex items-center justify-center gap-3"
          >
            {loginStep === "VERIFYING" || isSubmitting ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <span>{m.otp_verify_submit_login()}</span>
            )}
          </button>

          <div className="flex justify-between items-center text-[9px] font-mono uppercase tracking-widest">
            <button
              type="button"
              onClick={handleBackToCredentials}
              disabled={isSubmitting || loginStep === "SUCCESS"}
              className="text-muted-foreground/40 hover:text-foreground transition-colors disabled:opacity-30"
            >
              ← {m.otp_back()}
            </button>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={
                resendSecondsLeft > 0 || isSubmitting || loginStep === "SUCCESS"
              }
              className="text-muted-foreground/40 hover:text-foreground transition-colors disabled:opacity-30"
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