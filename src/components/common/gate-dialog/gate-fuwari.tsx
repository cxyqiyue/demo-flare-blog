import { ArrowLeft, ExternalLink, Loader2, X } from "lucide-react";
import type React from "react";
import { m } from "@/paraglide/messages";
import type {
  AccessGateError,
  AccessGateMode,
} from "@/components/common/access-gate.types";

export interface GateContentProps {
  mode: AccessGateMode;
  title?: string;
  channel?: string | null;
  hint?: string | null;
  error?: AccessGateError | null;
  isSubmitting?: boolean;
  isSuccess?: boolean;
  loginUrl?: string;
  password: string;
  setPassword: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
  onChannelOpen: () => void;
}

const eyebrowOf = (mode: AccessGateMode): string =>
  mode === "private"
    ? m.access_gate_eyebrow_private()
    : mode === "login"
      ? m.access_gate_eyebrow_login()
      : m.access_gate_eyebrow_password();

const descOf = (mode: AccessGateMode): string =>
  mode === "private"
    ? m.access_gate_desc_private()
    : mode === "login"
      ? m.access_gate_desc_login()
      : m.access_gate_desc_password();

const titleOf = (mode: AccessGateMode, title?: string): string =>
  title ||
  (mode === "private"
    ? m.access_gate_title_private()
    : mode === "login"
      ? m.access_gate_title_login()
      : m.access_gate_title_password());

const errorMessage: Record<AccessGateError, string> = {
  wrongPassword: m.access_gate_error_wrong_password(),
  rateLimited: m.access_gate_error_rate_limited(),
  locked: m.access_gate_error_locked_too_many(),
  invalidLink: m.access_gate_error_invalid_link(),
  generic: m.access_gate_error_generic(),
};

export function FuwariGateContent(props: GateContentProps) {
  const {
    mode,
    title,
    channel,
    hint,
    error,
    isSubmitting,
    isSuccess,
    loginUrl = "/login",
    password,
    setPassword,
    onSubmit,
    onClose,
    onChannelOpen,
  } = props;

  return (
    <div className="relative w-full max-w-md fuwari-card-base border border-(--fuwari-input-border) p-6 md:p-8 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-(--fuwari-input-border)">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] fuwari-text-30">
            [ {eyebrowOf(mode)} ]
          </p>
          <h2 className="text-lg font-bold fuwari-text-90 break-words">
            {titleOf(mode, title)}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="shrink-0 p-1 -mr-1 -mt-1 fuwari-text-50 hover:text-(--fuwari-primary) transition-colors disabled:opacity-50"
          aria-label={m.common_close()}
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      {/* Body */}
      <div className="pt-5 flex flex-col gap-5">
        <p className="text-sm font-medium fuwari-text-50 leading-relaxed">
          {descOf(mode)}
        </p>

        {mode === "password" ? (
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            {hint && hint.trim() !== "" && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-bold uppercase tracking-widest fuwari-text-30">
                  {m.access_gate_hint_label()}
                </p>
                <p className="text-sm font-medium fuwari-text-50 whitespace-pre-wrap">
                  {hint}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="access-gate-password"
                className="text-sm font-bold fuwari-text-50"
              >
                {m.access_gate_input_label()}
              </label>
              <input
                id="access-gate-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={m.access_gate_input_placeholder()}
                autoComplete="off"
                autoFocus
                disabled={isSubmitting || isSuccess}
                className="w-full bg-(--fuwari-input-bg) border border-(--fuwari-input-border) rounded-xl px-4 py-3 text-(--fuwari-text-90) placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none focus:border-(--fuwari-primary)/50 focus:bg-(--fuwari-primary)/5 transition-all text-sm disabled:opacity-50"
              />
            </div>

            {error && (
              <p role="alert" className="text-xs font-semibold text-red-500">
                {errorMessage[error]}
              </p>
            )}

            {channel && channel.trim() !== "" && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold uppercase tracking-widest fuwari-text-30">
                  {m.access_gate_channel_tip()}
                </p>
                <button
                  type="button"
                  onClick={onChannelOpen}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl fuwari-btn-regular font-bold text-sm active:scale-[0.98] transition-all"
                >
                  <ExternalLink size={14} strokeWidth={2} />
                  <span>{m.access_gate_get_password_btn()}</span>
                </button>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1 border-t border-(--fuwari-input-border)">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting || isSuccess}
                className="flex items-center gap-1.5 text-xs font-bold fuwari-text-50 hover:text-(--fuwari-primary) transition-colors disabled:opacity-50"
              >
                <ArrowLeft size={13} className="-ml-1" />
                <span>{m.access_gate_back_btn()}</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting || isSuccess || !password.trim()}
                className="flex items-center justify-center gap-2 py-3 px-6 rounded-xl fuwari-btn-primary font-bold text-sm active:scale-[0.98] transition-all"
              >
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                <span>
                  {isSubmitting
                    ? m.common_processing()
                    : isSuccess
                      ? m.access_gate_password_success()
                      : m.access_gate_submit()}
                </span>
              </button>
            </div>
          </form>
        ) : mode === "login" ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium fuwari-text-50">
              {m.access_gate_login_hint()}
            </p>
            <a
              href={loginUrl}
              className="shrink-0 py-3 px-6 rounded-xl fuwari-btn-primary font-bold text-sm active:scale-[0.98] transition-all"
            >
              {m.access_gate_login_cta()}
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
