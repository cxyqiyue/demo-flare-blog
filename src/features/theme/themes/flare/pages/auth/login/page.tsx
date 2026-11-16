import { Link } from "@tanstack/react-router";
import type { LoginPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";
import { LoginForm } from "./form";
import { SocialLogin } from "./social-login";

export function LoginPage({
  isEmailConfigured,
  loginForm,
  socialLogin,
  challengeElement,
}: LoginPageProps) {
  return (
    <div className="space-y-8">
      <header className="text-center space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {isEmailConfigured ? m.login_label() : m.login_auth_label()}
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          {isEmailConfigured ? m.login_title() : m.login_auth_title()}
        </h1>
        {!isEmailConfigured && (
          <p className="text-sm text-muted-foreground">
            {m.login_only_third_party()}
          </p>
        )}
      </header>

      <div className={isEmailConfigured ? "space-y-6" : "space-y-0"}>
        {isEmailConfigured && (
          <LoginForm form={loginForm} isEmailConfigured={isEmailConfigured} />
        )}

        {loginForm.loginStep === "IDLE" && (
          <SocialLogin
            isLoading={socialLogin.isLoading}
            challengePending={socialLogin.challengePending}
            handleGithubLogin={socialLogin.handleGithubLogin}
            showDivider={isEmailConfigured}
          />
        )}

        {challengeElement}

        {isEmailConfigured && (
          <div className="text-center pt-2">
            <p className="text-sm text-muted-foreground">
              {m.login_no_account()}{" "}
              <Link
                to="/register"
                className="text-foreground hover:underline underline-offset-4"
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
