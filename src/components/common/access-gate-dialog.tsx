import { ClientOnly } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import type {
  AccessGateError,
  AccessGateMode,
} from "@/components/common/access-gate.types";
import { DefaultGateContent } from "@/components/common/gate-dialog/gate-default";
import { FlareGateDialog } from "@/components/common/gate-dialog/gate-flare";
import { FuwariGateContent } from "@/components/common/gate-dialog/gate-fuwari";

export type {
  AccessGateError,
  AccessGateMode,
} from "@/components/common/access-gate.types";

interface AccessGateDialogProps {
  open: boolean;
  mode: AccessGateMode;
  title?: string;
  channel?: string | null;
  hint?: string | null;
  error?: AccessGateError | null;
  retryAfterSeconds?: number;
  isSubmitting?: boolean;
  isSuccess?: boolean;
  loginUrl?: string;
  onSubmitPassword?: (password: string) => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}

function AccessGateDialogInternal({
  open,
  mode,
  title,
  channel,
  hint,
  error,
  retryAfterSeconds = 0,
  isSubmitting = false,
  isSuccess = false,
  loginUrl = "/login",
  onSubmitPassword,
  onOpenChange,
}: AccessGateDialogProps) {
  const [password, setPassword] = useState("");
  const passwordId = useId();

  useEffect(() => {
    if (open) setPassword("");
  }, [open, mode]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!password.trim() || isSubmitting || isSuccess || retryAfterSeconds > 0) return;
    void onSubmitPassword?.(password);
  };

  const handleChannelOpen = () => {
    if (!channel) return;
    const url = channel.trim();
    const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    window.open(target, "_blank", "noopener,noreferrer");
  };

  const onClose = () => onOpenChange(false);

  const contentProps = {
    mode,
    title,
    channel,
    hint,
    error,
    retryAfterSeconds,
    passwordId,
    isSubmitting,
    isSuccess,
    loginUrl,
    password,
    setPassword,
    onSubmit: handleSubmit,
    onClose,
    onChannelOpen: handleChannelOpen,
  };

  let dialogContent: React.ReactNode;
  switch (__THEME_NAME__) {
    case "fuwari":
      dialogContent = <FuwariGateContent {...contentProps} />;
      break;
    case "flare":
      return <FlareGateDialog {...contentProps} open={open} />;
    case "default":
      dialogContent = <DefaultGateContent {...contentProps} />;
      break;
    default:
      __THEME_NAME__ satisfies never;
      dialogContent = <DefaultGateContent {...contentProps} />;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 transition-all duration-300 ${
        open
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-md"
        aria-hidden="true"
      />
      <div
        className={`w-full max-w-md flex transform transition-all duration-300 ${
          open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {dialogContent}
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
