import { ClientOnly } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Loader2, X } from "lucide-react";
import type React from "react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { m } from "@/paraglide/messages";

export type AccessGateMode = "private" | "password" | "login";

export type AccessGateError =
  | "wrongPassword"
  | "rateLimited"
  | "locked"
  | "invalidLink"
  | "generic";

interface AccessGateDialogProps {
  open: boolean;
  mode: AccessGateMode;
  title?: string;
  channel?: string | null;
  hint?: string | null;
  error?: AccessGateError | null;
  isSubmitting?: boolean;
  isSuccess?: boolean;
  loginUrl?: string;
  onSubmitPassword?: (password: string) => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}

const errorMessage: Record<AccessGateError, () => string> = {
  wrongPassword: () => m.access_gate_error_wrong_password(),
  rateLimited: () => m.access_gate_error_rate_limited(),
  locked: () => m.access_gate_error_locked_too_many(),
  invalidLink: () => m.access_gate_error_invalid_link(),
  generic: () => m.access_gate_error_generic(),
};

function AccessGateDialogInternal({
  open,
  mode,
  title,
  channel,
  hint,
  error,
  isSubmitting = false,
  isSuccess = false,
  loginUrl = "/login",
  onSubmitPassword,
  onOpenChange,
}: AccessGateDialogProps) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (open) setPassword("");
  }, [open]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!password.trim() || isSubmitting) return;
    void onSubmitPassword?.(password);
  };

  const eyebrow =
    mode === "private"
      ? m.access_gate_eyebrow_private()
      : mode === "login"
        ? m.access_gate_eyebrow_login()
        : m.access_gate_eyebrow_password();

  const desc =
    mode === "private"
      ? m.access_gate_desc_private()
      : mode === "login"
        ? m.access_gate_desc_login()
        : m.access_gate_desc_password();

  const handleChannelOpen = () => {
    if (!channel) return;
    const url = channel.trim();
    const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    window.open(target, "_blank", "noopener,noreferrer");
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 transition-all duration-300 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-md bg-background border border-border/30 shadow-2xl flex flex-col transform transition-all duration-300 ${
          open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {/* Header */}
        <div className="px-7 pt-7 pb-5 flex items-start justify-between border-b border-border/30">
          <div className="space-y-2 min-w-0">
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
              [ {eyebrow} ]
            </p>
            <h2 className="text-xl font-serif font-medium tracking-tight text-foreground truncate">
              {title || (mode === "private" ? m.access_gate_title_private() : mode === "login" ? m.access_gate_title_login() : m.access_gate_title_password())}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="p-2 -mr-1 -mt-1 text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-50"
            aria-label={m.common_close()}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-6">
          <p className="text-sm text-muted-foreground/80 leading-relaxed font-light">
            {desc}
          </p>

          {mode === "password" ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {hint && hint.trim() !== "" && (
                <div className="px-4 py-3 bg-muted/20 border-l-2 border-foreground/30">
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/70 mb-1">
                    {m.access_gate_hint_label()}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {hint}
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="access-gate-password"
                  className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70"
                >
                  {m.access_gate_input_label()}
                </label>
                <Input
                  id="access-gate-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={m.access_gate_input_placeholder()}
                  autoComplete="off"
                  autoFocus
                  disabled={isSubmitting || isSuccess}
                  className="mt-2"
                />
              </div>

              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {errorMessage[error]()}
                </p>
              )}

              {channel && channel.trim() !== "" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground/70">
                    {m.access_gate_channel_tip()}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleChannelOpen}
                    className="w-full gap-2 rounded-none font-mono text-[11px] uppercase tracking-widest"
                  >
                    <ExternalLink size={12} />
                    <span>{m.access_gate_get_password_btn()}</span>
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting || isSuccess}
                  className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <ArrowLeft size={12} />
                  <span>{m.access_gate_back_btn()}</span>
                </button>

                <Button
                  type="submit"
                  disabled={isSubmitting || isSuccess || !password.trim()}
                  className="flex items-center justify-center gap-2 rounded-none font-mono text-[11px] uppercase tracking-widest"
                >
                  {isSubmitting && <Loader2 size={12} className="animate-spin" />}
                  <span>
                    {isSubmitting
                      ? m.common_processing()
                      : isSuccess
                        ? m.access_gate_password_success()
                        : m.access_gate_submit()}
                  </span>
                </Button>
              </div>
            </form>
          ) : mode === "login" ? (
            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground/70">
                {m.access_gate_login_hint()}
              </p>
              <Button asChild>
                <a href={loginUrl}>{m.access_gate_login_cta()}</a>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function AccessGateDialog(props: AccessGateDialogProps) {
  return (
    <ClientOnly>
      <AccessGateDialogInternal {...props} />
    </ClientOnly>
  );
}
