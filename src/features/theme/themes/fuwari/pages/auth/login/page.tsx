import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { GithubIcon } from "@/components/common/brand-icon";
import type { LoginPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";

export function LoginPage({
  isEmailConfigured,
  loginForm,
  socialLogin,
  challengeElement,
}: LoginPageProps) {
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
  } = loginForm;

  const {
    isLoading: socialIsLoading,
    challengePending,
    handleGithubLogin,
  } = socialLogin;

  const isIdle = loginStep === "IDLE";
  const isFormDisabled = isSubmitting || !isIdle;
  const isSocialDisabled = socialIsLoading || challengePending;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold fuwari-text-90">
          {isEmailConfigured ? m.login_title() : m.login_auth_title()}
        </h1>
        <p className="text-sm font-medium fuwari-text-50">
          {isEmailConfigured
            ? m.login_welcome_back()
            : m.login_only_third_party_fuwari()}
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Email Login Form */}
        {isEmailConfigured && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {isIdle ? (
              <>
                <div className="flex flex-col gap-1.5 focus-within:text-(--fuwari-primary) transition-colors text-(--fuwari-text-50)">
                  <label
                    htmlFor="login-email"
                    className="text-sm font-bold ml-1"
                  >
                    {m.login_email_address()}
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    {...register("email")}
                    placeholder={m.login_email_placeholder()}
                    autoComplete="username"
                    disabled={isFormDisabled}
                    className="w-full bg-(--fuwari-input-bg) border border-(--fuwari-input-border) rounded-xl px-4 py-3 text-(--fuwari-text-90) placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none focus:border-(--fuwari-primary)/50 focus:bg-(--fuwari-primary)/5 transition-all text-sm outline-none"
                  />
                  {errors.email && (
                    <span className="text-xs text-red-500 ml-1 mt-1 font-medium">
                      {errors.email.message}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 focus-within:text-(--fuwari-primary) transition-colors text-(--fuwari-text-50)">
                  <div className="flex justify-between items-center ml-1">
                    <label
                      htmlFor="login-password"
                      className="text-sm font-bold"
                    >
                      {m.login_password()}
                    </label>
                    <Link
                      to="/forgot-password"
                      tabIndex={-1}
                      className="text-xs font-medium hover:text-(--fuwari-primary) transition-colors"
                    >
                      {m.login_forgot_password_fuwari()}
                    </Link>
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    {...register("password")}
                    placeholder={m.login_password_placeholder()}
                    autoComplete="current-password"
                    disabled={isFormDisabled}
                    className="w-full bg-(--fuwari-input-bg) border border-(--fuwari-input-border) rounded-xl px-4 py-3 text-(--fuwari-text-90) placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none focus:border-(--fuwari-primary)/50 focus:bg-(--fuwari-primary)/5 transition-all text-sm outline-none"
                  />
                  {errors.password && (
                    <span className="text-xs text-red-500 ml-1 mt-1 font-medium">
                      {errors.password.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 w-full py-3.5 rounded-xl fuwari-btn-primary font-bold text-sm tracking-wide active:scale-[0.98] transition-all gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span>{m.otp_sending_code()}</span>
                    </>
                  ) : (
                    <span>{m.otp_send_code()}</span>
                  )}
                </button>
              </>
            ) : (
              <>
                <div className="text-center space-y-1.5">
                  <p className="text-sm font-medium fuwari-text-50">
                    {m.otp_desc_login({ email: otpEmail ?? "" })}
                  </p>
                  <p className="text-xs font-medium fuwari-text-30">
                    {m.otp_expires_hint()}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 focus-within:text-(--fuwari-primary) transition-colors text-(--fuwari-text-50)">
                  <label
                    htmlFor="login-otp"
                    className="text-sm font-bold ml-1"
                  >
                    {m.otp_code_label()}
                  </label>
                  <input
                    id="login-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    {...register("otp")}
                    placeholder="000000"
                    disabled={isSubmitting || loginStep === "SUCCESS"}
                    className="w-full bg-(--fuwari-input-bg) border border-(--fuwari-input-border) rounded-xl px-4 py-3 text-center text-lg font-mono tracking-[0.5em] text-(--fuwari-text-90) placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none focus:border-(--fuwari-primary)/50 focus:bg-(--fuwari-primary)/5 transition-all text-sm outline-none"
                  />
                  {errors.otp && (
                    <span className="text-xs text-red-500 ml-1 mt-1 font-medium">
                      {errors.otp.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={
                    isSubmitting || loginStep === "SUCCESS"
                  }
                  className="mt-2 w-full py-3.5 rounded-xl fuwari-btn-primary font-bold text-sm tracking-wide active:scale-[0.98] transition-all gap-2"
                >
                  {loginStep === "VERIFYING" || isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span>{m.otp_verifying()}</span>
                    </>
                  ) : (
                    <span>{m.otp_verify_submit_login()}</span>
                  )}
                </button>

                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={handleBackToCredentials}
                    disabled={isSubmitting || loginStep === "SUCCESS"}
                    className="text-xs font-medium fuwari-text-50 hover:text-(--fuwari-primary) transition-colors disabled:opacity-40"
                  >
                    ← {m.otp_back()}
                  </button>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={
                      resendSecondsLeft > 0 ||
                      isSubmitting ||
                      loginStep === "SUCCESS"
                    }
                    className="text-xs font-medium fuwari-text-50 hover:text-(--fuwari-primary) transition-colors disabled:opacity-40"
                  >
                    {resendSecondsLeft > 0
                      ? m.otp_resend_in({
                          seconds: String(resendSecondsLeft),
                        })
                      : m.otp_resend()}
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {/* Divider */}
        {isEmailConfigured && loginStep === "IDLE" && (
          <div className="relative flex items-center py-2">
            <div className="flex-1 border-t border-border/30"></div>
            <span className="mx-4 text-xs font-medium fuwari-text-30">
              {m.login_or()}
            </span>
            <div className="flex-1 border-t border-border/30"></div>
          </div>
        )}

        {/* Social Login */}
        {loginStep === "IDLE" && (
          <button
            type="button"
            onClick={handleGithubLogin}
            disabled={isSocialDisabled}
            className={`group w-full py-3.5 rounded-xl flex gap-3 transition-all font-bold text-sm active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${
              !isEmailConfigured ? "fuwari-btn-primary" : "fuwari-btn-regular"
            }`}
          >
            {socialIsLoading ? (
              <Loader2 size={16} className="animate-spin opacity-70" />
            ) : (
              <GithubIcon size={16} />
            )}

            <span className="tracking-wide">
              {socialIsLoading
                ? m.login_social_connecting()
                : m.login_github_fuwari()}
            </span>
          </button>
        )}

        {challengeElement}

        {/* Footer Link */}
        {isEmailConfigured && (
          <div className="text-center pt-2">
            <p className="text-sm font-medium fuwari-text-50">
              {m.login_no_account()}{" "}
              <Link
                to="/register"
                className="text-(--fuwari-primary) hover:underline"
              >
                {m.login_register_now()}
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}