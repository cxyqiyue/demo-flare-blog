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

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {isIdle ? (
        <>
          <div className="space-y-6">
            <div className="space-y-2 group">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 group-focus-within:text-foreground transition-colors">
                {m.register_nickname()}
              </label>
              <Input
                type="text"
                {...register("name")}
                className="w-full bg-transparent border-0 border-b border-border/40 rounded-none py-3 text-sm font-light focus-visible:ring-0 focus:border-foreground focus:outline-none transition-all placeholder:text-muted-foreground/30 shadow-none px-0"
                placeholder={m.register_nickname_placeholder()}
                disabled={isSubmitting}
              />
              {errors.name && (
                <span className="text-[9px] font-mono text-destructive uppercase tracking-widest mt-1 block">
                  {errors.name.message}
                </span>
              )}
            </div>

            <div className="space-y-2 group">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 group-focus-within:text-foreground transition-colors">
                {m.login_email_address()}
              </label>
              <Input
                type="email"
                {...register("email")}
                className="w-full bg-transparent border-0 border-b border-border/40 rounded-none py-3 text-sm font-light focus-visible:ring-0 focus:border-foreground focus:outline-none transition-all placeholder:text-muted-foreground/30 shadow-none px-0"
                placeholder={m.login_email_placeholder()}
                disabled={isSubmitting}
              />
              {errors.email && (
                <span className="text-[9px] font-mono text-destructive uppercase tracking-widest mt-1 block">
                  {errors.email.message}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 group">
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 group-focus-within:text-foreground transition-colors">
                  {m.register_password()}
                </label>
                <Input
                  type="password"
                  {...register("password")}
                  className="w-full bg-transparent border-0 border-b border-border/40 rounded-none py-3 text-sm font-light focus-visible:ring-0 focus:border-foreground focus:outline-none transition-all placeholder:text-muted-foreground/30 shadow-none px-0"
                  placeholder={m.login_password_placeholder()}
                  disabled={isSubmitting}
                />
                {errors.password && (
                  <span className="text-[9px] font-mono text-destructive uppercase tracking-widest mt-1 block">
                    {errors.password.message}
                  </span>
                )}
              </div>
              <div className="space-y-2 group">
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 group-focus-within:text-foreground transition-colors">
                  {m.register_confirm_password()}
                </label>
                <Input
                  type="password"
                  {...register("confirmPassword")}
                  className="w-full bg-transparent border-0 border-b border-border/40 rounded-none py-3 text-sm font-light focus-visible:ring-0 focus:border-foreground focus:outline-none transition-all placeholder:text-muted-foreground/30 shadow-none px-0"
                  placeholder={m.login_password_placeholder()}
                  disabled={isSubmitting}
                />
                {errors.confirmPassword && (
                  <span className="text-[9px] font-mono text-destructive uppercase tracking-widest mt-1 block">
                    {errors.confirmPassword.message}
                  </span>
                )}
              </div>
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
              [ {m.register_label()} ]
            </p>
            <p className="text-xs text-muted-foreground/70 font-light leading-relaxed">
              {m.otp_desc_register({ email: otpEmail ?? "" })}
            </p>
            <p className="text-[9px] font-mono text-muted-foreground/40">
              {m.otp_expires_hint()}
            </p>
          </div>

          <div className="space-y-2 group">
            <label
              htmlFor="register-otp"
              className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 group-focus-within:text-foreground transition-colors"
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
              className="w-full bg-transparent border-0 border-b border-border/40 rounded-none py-3 text-center text-lg font-mono tracking-[0.5em] focus-visible:ring-0 focus:border-foreground focus:outline-none transition-all placeholder:text-muted-foreground/30 shadow-none px-0"
              placeholder="000000"
              disabled={isSubmitting || registerStep === "SUCCESS"}
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
              isSubmitting || registerStep === "SUCCESS"
            }
            className="w-full py-4 bg-foreground text-background text-[10px] font-mono uppercase tracking-[0.3em] hover:opacity-80 transition-all disabled:opacity-30 flex items-center justify-center gap-3"
          >
            {registerStep === "VERIFYING" || isSubmitting ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <span>{m.otp_verify_submit_register()}</span>
            )}
          </button>

          <div className="flex justify-between items-center text-[9px] font-mono uppercase tracking-widest">
            <button
              type="button"
              onClick={handleBackToCredentials}
              disabled={isSubmitting || registerStep === "SUCCESS"}
              className="text-muted-foreground/40 hover:text-foreground transition-colors disabled:opacity-30"
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