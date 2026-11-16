import { Link } from "@tanstack/react-router";
import type { ForgotPasswordPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";
import { ForgotPasswordForm } from "./form";

export function ForgotPasswordPage({
  forgotPasswordForm,
}: ForgotPasswordPageProps) {
  if (forgotPasswordForm.isSent) {
    return (
      <div className="text-center space-y-6 animate-in fade-in duration-500">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {m.forgot_password_success_label()}
          </p>
          <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
            {m.forgot_password_success_title()}
          </h3>
          <p className="text-sm text-muted-foreground leading-6">
            {m.forgot_password_success_desc({
              email: forgotPasswordForm.sentEmail,
            })}
          </p>
        </div>
        <Link
          to="/login"
          className="inline-flex w-full h-11 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          {m.forgot_password_back_to_login()}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="text-center space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {m.forgot_password_label()}
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          {m.forgot_password_title()}
        </h1>
      </header>

      <div className="space-y-6">
        <ForgotPasswordForm form={forgotPasswordForm} />
      </div>
    </div>
  );
}
