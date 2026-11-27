import { ArrowLeft, ExternalLink, Loader2, LockKeyhole } from "lucide-react";
import type { GateContentProps } from "@/components/common/access-gate.types";
import { Button, buttonVariants } from "@/components/ui/button";
import { FlareDialog } from "@/components/ui/flare-dialog";
import { Input } from "@/components/ui/input";
import { m } from "@/paraglide/messages";
import { gateDescription, gateErrorMessage, gateTitle } from "./gate-messages";

export function FlareGateDialog({
  open,
  mode,
  title,
  channel,
  hint,
  error,
  retryAfterSeconds = 0,
  isSubmitting,
  isSuccess,
  loginUrl = "/login",
  password,
  passwordId,
  setPassword,
  onSubmit,
  onClose,
  onChannelOpen,
}: GateContentProps & { open: boolean }) {
  const feedbackId = passwordId + "-feedback";
  const hintId = passwordId + "-hint";
  const busy = Boolean(isSubmitting || isSuccess);

  return (
    <FlareDialog
      open={open}
      onClose={onClose}
      title={gateTitle(mode, title)}
      description={gateDescription(mode)}
      busy={busy}
      className="max-w-md"
    >
      {mode === "password" ? (
        <form onSubmit={onSubmit} className="space-y-5">
          {hint?.trim() ? (
            <div id={hintId} className="space-y-2 rounded-xl bg-muted/50 p-4">
              <p className="text-sm font-medium">{m.access_gate_hint_label()}</p>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{hint}</p>
            </div>
          ) : null}
          <div className="space-y-2">
            <label htmlFor={passwordId} className="text-sm font-medium">{m.access_gate_input_label()}</label>
            <Input
              id={passwordId}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={m.access_gate_input_placeholder()}
              autoComplete="current-password"
              disabled={busy}
              aria-invalid={error === "wrongPassword"}
              aria-describedby={[hint?.trim() ? hintId : null, error ? feedbackId : null].filter(Boolean).join(" ") || undefined}
            />
          </div>
          {error ? (
            <p id={feedbackId} role="alert" className="text-sm leading-6 text-destructive">
              {gateErrorMessage(error)}
              {retryAfterSeconds > 0 && " " + m.access_gate_retry_countdown({ seconds: String(retryAfterSeconds) })}
            </p>
          ) : null}
          {isSuccess ? <p role="status" className="text-sm text-muted-foreground">{m.access_gate_password_success()}</p> : null}
          {channel?.trim() ? (
            <div className="space-y-2">
              <p className="text-sm leading-6 text-muted-foreground">{m.access_gate_channel_tip()}</p>
              <Button type="button" variant="outline" onClick={onChannelOpen} className="w-full">
                <ExternalLink size={16} aria-hidden="true" />{m.access_gate_get_password_btn()}
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              <ArrowLeft size={16} aria-hidden="true" />{m.access_gate_back_btn()}
            </Button>
            <Button type="submit" disabled={busy || retryAfterSeconds > 0 || !password.trim()}>
              {isSubmitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />}
              {isSubmitting ? m.common_processing() : m.access_gate_submit()}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            <ArrowLeft size={16} aria-hidden="true" />{m.access_gate_back_btn()}
          </Button>
          {mode === "login" ? <a href={loginUrl} className={buttonVariants()}>{m.access_gate_login_cta()}</a> : null}
        </div>
      )}
    </FlareDialog>
  );
}
