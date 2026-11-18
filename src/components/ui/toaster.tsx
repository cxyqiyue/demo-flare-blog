import type React from "react";
import type { ToasterProps } from "sonner";
import { Toaster as Sonner } from "sonner";
import { isFlare, isFuwari } from "@/lib/theme-mode";

const Toaster: React.FC<ToasterProps> = (props) => {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      visibleToasts={3}
      duration={4000}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: isFlare
            ? "group relative flex w-full max-w-[calc(100vw-2rem)] items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-foreground shadow-xl sm:max-w-[380px]"
            : isFuwari
              ? "group w-full max-w-[calc(100vw-2rem)] sm:max-w-[350px] flex items-start justify-between gap-4 p-5 bg-(--fuwari-card-bg) rounded-(--fuwari-radius-large) shadow-lg transition-all duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right-10 data-[state=open]:slide-in-from-bottom-4 [&:has([data-button])]:pr-10"
              : "group relative w-full max-w-[350px] flex items-start justify-between gap-4 p-5 bg-background border border-border/40 shadow-sm transition-all duration-500 hover:border-border/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right-10 data-[state=open]:slide-in-from-bottom-4 [&:has([data-button])]:pr-10",
          title: isFuwari
            ? "text-sm font-medium fuwari-text-90 tracking-tight"
            : "text-sm font-medium text-foreground tracking-tight",
          description: isFuwari
            ? "text-xs fuwari-text-50 mt-1"
            : "text-xs text-muted-foreground mt-1",
          content: "flex flex-col gap-0.5 flex-1 min-w-0 pr-2",
          actionButton: isFlare
            ? "min-h-11 shrink-0 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground"
            : isFuwari
              ? "shrink-0 fuwari-btn-primary text-xs font-medium px-4 py-2 rounded-(--fuwari-radius-large)"
              : "shrink-0 bg-foreground text-background text-xs font-medium px-4 py-2 hover:opacity-90 transition-opacity rounded-none",
          cancelButton: isFlare
            ? "min-h-11 shrink-0 rounded-xl border border-border px-3 text-sm font-medium"
            : isFuwari
              ? "shrink-0 fuwari-btn-regular text-xs font-medium px-4 py-2 rounded-(--fuwari-radius-large)"
              : "shrink-0 border border-border bg-transparent text-muted-foreground text-xs font-medium px-4 py-2 hover:bg-muted transition-colors rounded-none",
        },
      }}
      {...props}
    />
  );
};

export default Toaster;
