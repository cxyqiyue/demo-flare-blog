// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({ ClientOnly: ({ children }: { children: unknown }) => children }));
vi.mock("@/lib/theme-mode", () => ({ isFlare: true, isFuwari: false }));
vi.mock("@/paraglide/messages", () => ({ m: new Proxy({}, { get: (_, key) => () => String(key) }) }));
import AccessGateDialog from "./access-gate-dialog";

beforeEach(() => { vi.stubGlobal("__THEME_NAME__", "flare"); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.style.overflow = ""; });

describe("Flare access gates", () => {
  it("uses Flare controls and traps keyboard focus in the password gate", () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const onOpenChange = vi.fn();
    const onSubmitPassword = vi.fn();
    const view = render(createElement(AccessGateDialog, { open: true, mode: "password", hint: "Ask the author", onOpenChange, onSubmitPassword }));
    const dialog = screen.getByRole("dialog", { name: "access_gate_title_password" });
    const input = screen.getByLabelText("access_gate_input_label") as HTMLInputElement;
    expect(dialog.className).toContain("font-sans");
    expect(dialog.className).toContain("rounded-2xl");
    expect(input.className).toContain("rounded-xl");
    expect(document.activeElement).toBe(dialog);
    const first = screen.getByRole("button", { name: "common_close" });
    const back = screen.getByRole("button", { name: "access_gate_back_btn" });
    const last = screen.getByRole("button", { name: "access_gate_submit" }) as HTMLButtonElement;
    expect(last.disabled).toBe(true);
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(back);
    fireEvent.keyDown(back, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.change(input, { target: { value: "a-secret" } });
    expect(input.value).toBe("a-secret");
    expect(last.disabled).toBe(false);
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.submit(input.closest("form")!);
    expect(onSubmitPassword).toHaveBeenCalledExactlyOnceWith("a-secret");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    view.unmount();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("");
    trigger.remove();
  });

  it("explains private access and offers a keyboard-accessible back action", () => {
    const onOpenChange = vi.fn();
    render(createElement(AccessGateDialog, { open: true, mode: "private", onOpenChange }));
    expect(screen.getByRole("dialog", { name: "access_gate_title_private" })).toBeTruthy();
    expect(screen.getByText("access_gate_desc_private")).toBeTruthy();
    expect(screen.queryByLabelText("access_gate_input_label")).toBeNull();
    const back = screen.getByRole("button", { name: "access_gate_back_btn" });
    back.focus();
    expect(document.activeElement).toBe(back);
    fireEvent.click(back);
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("announces errors, blocks cooldown submit and retains the gate while refreshing", () => {
    const onSubmitPassword = vi.fn();
    const onOpenChange = vi.fn();
    const props = { open: true, mode: "password" as const, onOpenChange, onSubmitPassword };
    const view = render(createElement(AccessGateDialog, { ...props, error: "rateLimited", retryAfterSeconds: 12 }));
    const input = screen.getByLabelText("access_gate_input_label");
    fireEvent.change(input, { target: { value: "secret" } });
    fireEvent.submit(input.closest("form")!);
    expect(onSubmitPassword).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("access_gate_error_rate_limited");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    view.rerender(createElement(AccessGateDialog, { ...props, error: "wrongPassword" }));
    expect(input.getAttribute("aria-invalid")).toBe("true");
    view.rerender(createElement(AccessGateDialog, { ...props, isSubmitting: true }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).disabled).toBe(true);
  });
});
