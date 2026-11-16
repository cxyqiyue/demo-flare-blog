import type { AuthLayoutProps } from "@/features/theme/contract/layouts";
import { m } from "@/paraglide/messages";

export function AuthLayout({ onBack, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full flex flex-col bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-muted/40 via-background to-background" />
      <header className="h-16 flex items-center px-4 md:px-8">
        <button
          onClick={onBack}
          type="button"
          className="inline-flex items-center rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          ← {m.auth_layout_back_home()}
        </button>
      </header>

      <main className="flex-1 flex flex-col justify-center items-center p-4 md:p-8">
        <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card/85 backdrop-blur-sm p-6 md:p-8 shadow-sm">
          {children}
        </div>
      </main>

      <footer className="h-10" />
    </div>
  );
}
