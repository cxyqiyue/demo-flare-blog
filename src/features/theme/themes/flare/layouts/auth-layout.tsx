import type { AuthLayoutProps } from "@/features/theme/contract/layouts";
import { m } from "@/paraglide/messages";

export function AuthLayout({ onBack, children }: AuthLayoutProps) {
  return (
    <div className="flare-shell min-h-screen w-full flex flex-col bg-(--flare-ground) relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_360px_at_50%_-10%,hsl(var(--muted)/0.35),transparent_70%)]" />
      <header className="h-16 flex items-center px-4 md:px-8">
        <button onClick={onBack} type="button" className="flare-chip">
          ← {m.auth_layout_back_home()}
        </button>
      </header>

      <main className="flex-1 flex flex-col justify-center items-center p-4 md:p-8">
        <div className="w-full max-w-md flare-surface p-6 md:p-8 flare-enter">
          {children}
        </div>
      </main>

      <footer className="h-10" />
    </div>
  );
}
