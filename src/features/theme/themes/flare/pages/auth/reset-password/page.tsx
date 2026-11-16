import { Link } from "@tanstack/react-router";
import type { ResetPasswordPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";
import { ResetPasswordForm } from "./form";

export function ResetPasswordPage({
  resetPasswordForm,
  token,
  error,
}: ResetPasswordPageProps) {
  if (!token && !error) {
    return (
      <div className="text-center space-y-4 animate-in fade-in duration-500">
        <p className="text-sm text-destructive leading-6">
          {m.reset_password_error_missing_token()}
        </p>
        <Link
          to="/login"
          className="inline-flex w-full h-11 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          {m.register_back_to_login()}
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center space-y-4 animate-in fade-in duration-500">
        <p className="text-sm text-destructive leading-6">
          {m.reset_password_error_invalid_link({ error: error || "" })}
        </p>
        <Link
          to="/forgot-password"
          className="inline-flex w-full h-11 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          {m.reset_password_request_new_link()}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="text-center space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {m.reset_password_label()}
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          {m.reset_password_title()}
        </h1>
      </header>

      <ResetPasswordForm form={resetPasswordForm} />
    </div>
  );
}
