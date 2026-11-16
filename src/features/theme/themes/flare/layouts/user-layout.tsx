import { Link } from "@tanstack/react-router";
import type { UserLayoutProps } from "@/features/theme/contract/layouts";
import { m } from "@/paraglide/messages";

export function UserLayout({ isAuthenticated, children }: UserLayoutProps) {
  return (
    <div className="min-h-screen font-sans relative antialiased bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-muted/30 via-background to-background" />
      {isAuthenticated ? (
        <main className="relative z-10 max-w-4xl mx-auto w-full px-4 md:px-6 py-8 md:py-12">
          <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm p-4 md:p-6">
            {children}
          </div>
        </main>
      ) : (
        <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
          <div className="max-w-md w-full space-y-6 text-center rounded-2xl border border-border/50 bg-card/85 backdrop-blur-sm p-8 shadow-sm">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              {m.auth_layout_login_required()}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-7">
              {m.auth_layout_login_required_desc()}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                to="/login"
                className="inline-flex items-center rounded-full bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition"
              >
                {m.auth_layout_go_to_login()}
              </Link>
              <Link
                to="/"
                className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                {m.auth_layout_back_home()}
              </Link>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
