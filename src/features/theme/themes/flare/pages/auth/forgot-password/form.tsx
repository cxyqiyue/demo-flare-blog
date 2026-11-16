import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ForgotPasswordFormData } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";

interface ForgotPasswordFormProps {
  form: ForgotPasswordFormData;
}

export function ForgotPasswordForm({ form }: ForgotPasswordFormProps) {
  const { register, errors, handleSubmit, isSubmitting } = form;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm text-muted-foreground leading-6">
        {m.forgot_password_header_desc()}
      </p>

      <div className="space-y-2">
        <label
          htmlFor="email"
          className="text-sm font-medium text-foreground/90"
        >
          {m.forgot_password_email_label()}
        </label>
        <Input
          id="email"
          type="email"
          {...register("email")}
          className="h-11 rounded-lg border border-border/60 bg-background/60 px-3 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-border"
          placeholder={m.login_email_placeholder()}
        />
        {errors.email && (
          <span className="text-xs text-destructive block">
            {errors.email.message}
          </span>
        )}
      </div>

      <div className="space-y-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <span>{m.forgot_password_submit()}</span>
          )}
        </button>

        <Link
          to="/login"
          className="block w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {m.register_back_to_login()}
        </Link>
      </div>
    </form>
  );
}
