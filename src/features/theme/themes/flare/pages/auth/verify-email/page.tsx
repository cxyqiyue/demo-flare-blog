import { Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { VerifyEmailPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";

export function VerifyEmailPage({ status, error }: VerifyEmailPageProps) {
  const title =
    status === "ANALYZING"
      ? m.verify_email_analyzing_title()
      : status === "SUCCESS"
        ? m.verify_email_success_title()
        : m.verify_email_error_title();

  return (
    <div className="space-y-8 text-center">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {m.verify_email_header()}
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
      </header>

      <div className="flex flex-col items-center justify-center space-y-5 py-2">
        {status === "ANALYZING" ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-sm">{m.verify_email_analyzing_desc()}</p>
          </div>
        ) : null}

        {status === "SUCCESS" ? (
          <div className="space-y-5 w-full">
            <CheckCircle2 className="w-14 h-14 mx-auto text-foreground/80" />
            <p className="text-sm text-muted-foreground leading-7">
              {m.verify_email_success_desc()}
            </p>
            <Link
              to="/"
              className="inline-flex w-full h-11 items-center justify-center rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition"
            >
              {m.verify_email_success_action()}
            </Link>
          </div>
        ) : null}

        {status === "ERROR" ? (
          <div className="space-y-5 w-full">
            <AlertCircle className="w-14 h-14 mx-auto text-destructive/80" />
            <p className="text-sm text-muted-foreground leading-7">
              {error === "invalid_token"
                ? m.verify_email_error_invalid_token_desc()
                : m.verify_email_error_generic_desc()}
            </p>
            <div className="space-y-3">
              <Link
                to="/login"
                className="inline-flex w-full h-11 items-center justify-center rounded-full border border-border/60 bg-background/60 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                {m.verify_email_error_action()}
              </Link>
              <Link
                to="/login"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {m.verify_email_error_resend_action()}
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
