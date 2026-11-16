import { Link } from "@tanstack/react-router";
import type { UserLayoutProps } from "@/features/theme/contract/layouts";
import { m } from "@/paraglide/messages";

export function UserLayout({ isAuthenticated, children }: UserLayoutProps) {
  return (
    <div className="flare-shell min-h-screen font-sans relative antialiased bg-(--flare-ground)">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_360px_at_50%_-10%,hsl(var(--muted)/0.3),transparent_70%)]" />
      {isAuthenticated ? (
        <main className="relative z-10 max-w-4xl mx-auto w-full px-4 md:px-6 py-8 md:py-12 flare-enter">
          {children}
        </main>
      ) : (
        <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
          <div className="max-w-md w-full space-y-6 text-center flare-surface p-8 flare-enter">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              {m.auth_layout_login_required()}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-7">
              {m.auth_layout_login_required_desc()}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
              <Link
                to="/login"
                className="inline-flex items-center rounded-full bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition"
              >
                {m.auth_layout_go_to_login()}
              </Link>
              <Link to="/" className="flare-chip">
                {m.auth_layout_back_home()}
              </Link>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
