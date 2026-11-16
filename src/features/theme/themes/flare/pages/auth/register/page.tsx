import { Link } from "@tanstack/react-router";
import type { RegisterPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";
import { RegisterForm } from "./form";

export function RegisterPage({
  registerForm,
  challengeElement,
}: RegisterPageProps) {
  if (registerForm.isSuccess) {
    return (
      <div className="text-center space-y-6 animate-in fade-in duration-500">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {m.register_success_label()}
          </p>
          <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
            {m.register_success_title()}
          </h3>
          <p className="text-sm text-muted-foreground leading-6">
            {m.register_success_desc()}
          </p>
        </div>
        <Link
          to="/login"
          className="inline-flex w-full h-11 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          {m.register_back_to_login()}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="text-center space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {m.register_label()}
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          {m.register_title()}
        </h1>
      </header>

      <div className="space-y-6">
        <RegisterForm form={registerForm} />

        {challengeElement}

        <div className="text-center pt-1">
          <p className="text-sm text-muted-foreground">
            {m.register_have_account()}{" "}
            <Link
              to="/login"
              className="text-foreground hover:underline underline-offset-4"
            >
              {m.register_go_to_login()}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
