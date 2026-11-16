import { Loader2 } from "lucide-react";
import { GithubIcon } from "@/components/common/brand-icon";
import type { SocialLoginData } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";

interface SocialLoginProps extends SocialLoginData {
  showDivider?: boolean;
}

export function SocialLogin({
  isLoading,
  challengePending,
  handleGithubLogin,
  showDivider = true,
}: SocialLoginProps) {
  return (
    <div className="space-y-4">
      {showDivider && (
        <div className="relative flex items-center">
          <div className="grow h-px bg-border/40"></div>
          <span className="shrink-0 mx-3 text-xs text-muted-foreground/70">
            {m.login_or()}
          </span>
          <div className="grow h-px bg-border/40"></div>
        </div>
      )}

      <button
        type="button"
        onClick={handleGithubLogin}
        disabled={isLoading || challengePending}
        className={`w-full h-11 rounded-lg border flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          !showDivider
            ? "bg-foreground text-background border-transparent hover:opacity-90"
            : "border-border/60 bg-background/60 hover:bg-muted/50 hover:border-border"
        }`}
      >
        {isLoading ? (
          <Loader2
            size={16}
            className={`${showDivider ? "text-muted-foreground" : "text-background"} animate-spin`}
          />
        ) : (
          <GithubIcon size={16} strokeWidth={1.5} />
        )}
        <span className="text-sm font-medium">
          {isLoading ? m.login_social_connecting() : m.login_github()}
        </span>
      </button>
      {!showDivider && (
        <p className="text-xs text-muted-foreground/70 text-center">
          {m.login_powered_by_github()}
        </p>
      )}
    </div>
  );
}
