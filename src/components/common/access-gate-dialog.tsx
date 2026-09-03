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

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const channelUrl =
    channel && /^(https?|mailto):/i.test(channel.trim())
      ? channel.trim()
      : null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 transition-all duration-300 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className="absolute inset-0 bg-background/85 backdrop-blur-md"
        onClick={handleClose}
      />

      <div
        className={`relative w-full max-w-md bg-background/95 border border-border/30 shadow-[0_0_60px_rgba(0,0,0,0.08)] dark:shadow-[0_0_60px_rgba(0,0,0,0.35)] flex flex-col transform transition-all duration-300 ${
          open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {/* Header */}
        <div className="px-6 pt-8 pb-5 flex items-start justify-between border-b border-border/10">
          <div className="space-y-2 min-w-0">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
              [ {eyebrow} ]
            </p>
            <h2 className="text-2xl font-serif font-medium text-foreground leading-snug">
              {title ||
                (mode === "private"
                  ? m.access_gate_title_private()
                  : mode === "login"
                    ? m.access_gate_title_login()
                    : m.access_gate_title_password())}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 -mr-2 -mt-1 text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-50"
            aria-label={m.common_close()}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-6">
          <p className="text-base text-muted-foreground/80 leading-relaxed font-light">
            {desc}
          </p>

          {/* 密码获取提示 */}
          {mode === "password" && hint && (
            <div className="mt-5 rounded-md border border-border/20 bg-muted/30 px-4 py-3">
              <p className="text-xs leading-relaxed text-muted-foreground/80">
                {m.access_gate_hint_label()}
              </p>
              <p className="mt-1.5 text-sm text-foreground/90 font-light leading-relaxed">
                {hint}
              </p>
            </div>
          )}

          {mode === "password" ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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

              {/* 获取密码按钮 */}
              {channelUrl && (
                <div className="flex items-center justify-between gap-4 rounded-md border border-border/20 bg-muted/20 px-4 py-3">
                  <p className="text-xs text-muted-foreground/70">
                    {m.access_gate_channel_hint()}
                  </p>
                  <a
                    href={channelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border border-border/40 bg-transparent px-3 font-mono text-[10px] uppercase tracking-widest text-foreground transition-all hover:border-foreground"
                  >
                    {m.access_gate_get_password()}
                    <ExternalLink size={11} strokeWidth={1.5} />
                  </a>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="h-9 gap-1.5 rounded-none px-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft size={12} strokeWidth={1.5} />
                  {m.access_gate_back()}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || isSuccess || !password.trim()}
                  className="flex h-9 items-center gap-2 rounded-none px-4"
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
            <div className="mt-6">
              <p className="text-xs text-muted-foreground/70">
                {m.access_gate_login_hint()}
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="h-9 gap-1.5 rounded-none px-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft size={12} strokeWidth={1.5} />
                  {m.access_gate_back()}
                </Button>
                <a
                  href={loginUrl}
                  className="inline-flex h-9 items-center justify-center whitespace-nowrap bg-foreground px-4 font-mono text-[10px] uppercase tracking-widest text-background transition-all hover:opacity-80"
                >
                  {m.access_gate_login_cta()}
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="h-9 gap-1.5 rounded-none px-3 font-mono text-[10px] uppercase tracking-widest"
                >
                  <ArrowLeft size={12} strokeWidth={1.5} />
                  {m.access_gate_back()}
                </Button>
              </div>
            </div>
          )}
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
