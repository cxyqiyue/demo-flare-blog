import { Link } from "@tanstack/react-router";
import type { UserLayoutProps } from "@/features/theme/contract/layouts";
import { m } from "@/paraglide/messages";
import { PublicLayout } from "./public-layout";

export function UserLayout({
  isAuthenticated,
  children,
  ...props
}: UserLayoutProps) {
  return (
    <PublicLayout {...props}>
      <div className="mx-auto w-full max-w-3xl flare-enter">
        {isAuthenticated ? (
          children
        ) : (
          <section className="flare-surface space-y-5 p-6 text-center sm:p-8">
            <h1 className="text-2xl font-bold text-foreground">
              {m.auth_layout_login_required()}
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              {m.auth_layout_login_required_desc()}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {m.auth_layout_go_to_login()}
              </Link>
              <Link to="/" className="flare-chip min-h-11">
                {m.auth_layout_back_home()}
              </Link>
            </div>
          </section>
        )}
      </div>
    </PublicLayout>
  );
}
