// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/paraglide/messages", () => ({ m: { common_close: () => "关闭" } }));
vi.mock("@/lib/theme-mode", () => ({ isFlare: true, isFuwari: false }));

import { Checkbox } from "./checkbox";
import { FlareDialog } from "./flare-dialog";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("Flare dialog", () => {
  it("focuses the panel, closes on Escape, and restores the trigger", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const onClose = vi.fn();
    const view = render(
      createElement(
        FlareDialog,
        {
          open: true,
          title: "编辑目录",
          onClose,
        },
        createElement("input", { "aria-label": "名称" }),
      ),
    );
    const dialog = screen.getByRole("dialog", { name: "编辑目录" });
    expect(document.activeElement).toBe(dialog);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    view.unmount();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("");
    trigger.remove();
  });

  it("does not dismiss the parent when a nested file picker is open", () => {
    const onClose = vi.fn();
    render(
      createElement(
        FlareDialog,
        {
          open: true,
          title: "移动媒体",
          onClose,
        },
        createElement(
          "div",
          { "data-flare-popover": "true", tabIndex: 0 },
          createElement("button", { type: "button" }, "文件夹选项"),
        ),
      ),
    );
    const popover = screen.getByText("文件夹选项");
    popover.focus();
    fireEvent.keyDown(popover, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("prevents dismissal while a save is pending", () => {
    const onClose = vi.fn();
    render(
      createElement(
        FlareDialog,
        {
          open: true,
          busy: true,
          title: "保存中",
          onClose,
        },
        "内容",
      ),
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(
      screen.getByRole("button", { name: "关闭" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Flare checkbox", () => {
  it("supports uncontrolled form registration and controlled callbacks", () => {
    const onChange = vi.fn();
    const onCheckedChange = vi.fn();
    render(
      createElement(Checkbox, {
        "aria-label": "替换书签",
        defaultChecked: true,
        onChange,
        onCheckedChange,
      }),
    );
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
    expect(onChange).toHaveBeenCalledOnce();
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });
});
