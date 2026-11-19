import type { AuthLayoutProps } from "@/features/theme/contract/layouts";

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="default-theme min-h-[100svh] w-full flex flex-col">
      <main className="flex min-h-[100svh] flex-col justify-center items-center p-4 sm:p-6 md:p-12">
        <div className="w-full max-w-sm min-w-0 animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
