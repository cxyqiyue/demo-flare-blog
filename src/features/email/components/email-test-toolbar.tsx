import { Loader2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

interface EmailTestToolbarProps {
  status: "IDLE" | "TESTING" | "SUCCESS" | "ERROR";
  isConfigured: boolean;
  onTest: () => void;
}

export function EmailTestToolbar({
  status,
  isConfigured,
  onTest,
}: EmailTestToolbarProps) {
  if (isFuwari) {
    return (
      <div className="fuwari-card-base p-4 sm:p-5 md:p-6 fuwari-onload-animation flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-all duration-700",
                status === "SUCCESS"
                  ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                  : status === "ERROR"
                    ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                    : status === "TESTING"
                      ? "animate-pulse bg-amber-500"
                      : "bg-muted-foreground/20",
              )}
            />
            <span className="text-sm font-bold fuwari-text-75">
              {status === "SUCCESS"
                ? m.settings_email_test_status_success()
                : status === "ERROR"
                  ? m.settings_email_test_status_error()
                  : status === "TESTING"
                    ? m.settings_email_test_status_testing()
                    : m.settings_email_test_status_idle()}
            </span>
          </div>

          <span className="hidden h-4 w-px bg-(--fuwari-input-border) md:block" />

          <p className="hidden text-xs sm:text-sm fuwari-text-50 md:block">
            {status === "IDLE"
              ? m.settings_email_test_hint_idle()
              : m.settings_email_test_hint_current({ status })}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={onTest}
          disabled={status === "TESTING" || !isConfigured}
          className={cn(
            "h-10 rounded-xl px-8 text-sm font-medium fuwari-text-75 hover:text-(--fuwari-primary)",
            !isConfigured && "cursor-not-allowed opacity-30",
          )}
        >
          {status === "TESTING" ? (
            <Loader2 size={12} className="mr-3 animate-spin" />
          ) : (
            <Wifi size={12} className="mr-3" />
          )}
          {status === "TESTING"
            ? m.settings_email_test_btn_testing()
            : m.settings_email_test_btn_send()}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-between gap-6 bg-muted/10 p-6 px-10 sm:flex-row">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div
            className={`h-2.5 w-2.5 rounded-full transition-all duration-700 ${
              status === "SUCCESS"
                ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                : status === "ERROR"
                  ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                  : status === "TESTING"
                    ? "animate-pulse bg-amber-500"
                    : "bg-muted-foreground/20"
            }`}
          />
          <span className="text-sm font-serif font-medium text-foreground">
            {status === "SUCCESS"
              ? m.settings_email_test_status_success()
              : status === "ERROR"
                ? m.settings_email_test_status_error()
                : status === "TESTING"
                  ? m.settings_email_test_status_testing()
                  : m.settings_email_test_status_idle()}
          </span>
        </div>

        <span className="hidden h-4 w-px bg-border/30 md:block" />

        <p className="hidden text-xs text-muted-foreground md:block">
          {status === "IDLE"
            ? m.settings_email_test_hint_idle()
            : m.settings_email_test_hint_current({ status })}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onTest}
        disabled={status === "TESTING" || !isConfigured}
        className={`h-10 rounded-none border-border/50 px-8 text-[10px] font-mono uppercase tracking-[0.2em] transition-all hover:bg-background ${
          !isConfigured ? "cursor-not-allowed opacity-30" : "text-foreground"
        }`}
      >
        {status === "TESTING" ? (
          <Loader2 size={12} className="mr-3 animate-spin" />
        ) : (
          <Wifi size={12} className="mr-3" />
        )}
        {status === "TESTING"
          ? m.settings_email_test_btn_testing()
          : m.settings_email_test_btn_send()}
      </Button>
    </div>
  );
}
