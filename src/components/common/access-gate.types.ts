import type { FormEvent } from "react";

export type AccessGateMode = "private" | "password" | "login";

export type AccessGateError =
  | "wrongPassword"
  | "rateLimited"
  | "locked"
  | "postNotFound"
  | "generic";

export interface GateContentProps {
  mode: AccessGateMode;
  title?: string;
  channel?: string | null;
  hint?: string | null;
  error?: AccessGateError | null;
  retryAfterSeconds?: number;
  isSubmitting?: boolean;
  isSuccess?: boolean;
  loginUrl?: string;
  password: string;
  passwordId: string;
  setPassword: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
  onChannelOpen: () => void;
}
