import type { AccessGateError, AccessGateMode } from "../access-gate.types";
import { m } from "@/paraglide/messages";

export const gateTitle = (mode: AccessGateMode, title?: string): string =>
  title || (mode === "private" ? m.access_gate_title_private() : mode === "login" ? m.access_gate_title_login() : m.access_gate_title_password());

export const gateDescription = (mode: AccessGateMode): string =>
  mode === "private" ? m.access_gate_desc_private() : mode === "login" ? m.access_gate_desc_login() : m.access_gate_desc_password();

export function gateErrorMessage(error: AccessGateError): string {
  switch (error) {
    case "wrongPassword": return m.access_gate_error_wrong_password();
    case "rateLimited": return m.access_gate_error_rate_limited();
    case "locked": return m.access_gate_error_locked_too_many();
    case "postNotFound": return m.access_gate_error_post_not_found();
    case "generic": return m.access_gate_error_generic();
  }
}
