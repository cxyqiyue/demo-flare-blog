import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ResetPasswordFormData } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";

interface ResetPasswordFormProps {
  form: ResetPasswordFormData;
}

export function ResetPasswordForm({ form }: ResetPasswordFormProps) {
  const { register, errors, handleSubmit, isSubmitting } = form;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm text-muted-foreground leading-6">
        {m.reset_password_header_desc()}
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="new-password"
            className="text-sm font-medium text-foreground/90"
          >
            {m.reset_password_new_password()}
          </label>
          <Input
            type="password"
            id="new-password"
            {...register("password")}
            className="h-11 rounded-lg border border-border/60 bg-background/60 px-3 text-base md:text-sm shadow-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-border"
            placeholder={m.login_password_placeholder()}
          />
          {errors.password && (
            <span className="text-xs text-destructive block">
              {errors.password.message}
            </span>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirm-password"
            className="text-sm font-medium text-foreground/90"
          >
            {m.reset_password_confirm_new_password()}
          </label>
          <Input
            type="password"
            id="confirm-password"
            {...register("confirmPassword")}
            className="h-11 rounded-lg border border-border/60 bg-background/60 px-3 text-base md:text-sm shadow-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-border"
            placeholder={m.login_password_placeholder()}
          />
          {errors.confirmPassword && (
            <span className="text-xs text-destructive block">
              {errors.confirmPassword.message}
            </span>
          )}
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
          <span>{m.reset_password_submit()}</span>
        )}
      </button>
    </form>
  );
}
