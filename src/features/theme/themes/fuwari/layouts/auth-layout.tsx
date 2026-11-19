import type { AuthLayoutProps } from "@/features/theme/contract/layouts";

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-[100svh] bg-(--fuwari-page-bg) text-(--fuwari-text-75) flex flex-col items-center justify-center p-3 sm:p-4">
      {/* Background decoration (optional but adds to the theme) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-(--fuwari-primary) opacity-[0.03] rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-(--fuwari-primary) opacity-[0.03] rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md min-w-0 relative z-10 fuwari-onload-animation">
        {/* Auth Card Container */}
        <div className="fuwari-card-base p-5 sm:p-8 md:p-10 w-full min-w-0 shadow-lg">
          {children}
        </div>
      </div>
    </div>
  );
}
