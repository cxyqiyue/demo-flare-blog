// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TocDrawer } from "./toc-drawer";

vi.mock("./table-of-contents", () => ({
  default: ({ onNavigate }: { onNavigate: () => void }) =>
    createElement("button", { onClick: onNavigate }, "Heading"),
}));

beforeEach(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  document.body.style.overflow = "";
});

function openDrawer() {
  const view = render(
    createElement(TocDrawer, {
      headers: [{ id: "heading", text: "Heading", level: 2 }],
    }),
  );
  // The controls must escape the transformed article container on mobile.
  expect(view.container.childElementCount).toBe(0);
  const trigger = screen.getByRole("button", { expanded: false });
  expect(trigger.parentElement).toBe(document.body);
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog") as HTMLDialogElement;
  expect(dialog.open).toBe(true);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(document.body.style.overflow).toBe("hidden");
  return { ...view, trigger, dialog };
}

describe("article TOC overlay", () => {
  it("closes and reopens using the close button and Escape", () => {
    document.body.style.overflow = "auto";
    const { trigger, dialog } = openDrawer();
    fireEvent.click(dialog.querySelector("button") as HTMLButtonElement);
    expect(dialog.open).toBe(false);
    expect(document.body.style.overflow).toBe("auto");
    fireEvent.click(trigger);
    expect(dialog.open).toBe(true);
    fireEvent(dialog, new Event("cancel", { bubbles: true }));
    expect(dialog.open).toBe(false);
    expect(document.body.style.overflow).toBe("auto");
  });

  it("closes from the backdrop, but keeps clicks inside the panel open", () => {
    const { dialog } = openDrawer();
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      left: 70,
      right: 390,
      top: 0,
      bottom: 844,
    } as DOMRect);
    fireEvent.click(dialog, { clientX: 100, clientY: 100 });
    expect(dialog.open).toBe(true);
    fireEvent.click(dialog, { clientX: 20, clientY: 100 });
    expect(dialog.open).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });

  it("closes after navigation and restores scrolling on unmount", () => {
    const { trigger, dialog, unmount } = openDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Heading" }));
    expect(dialog.open).toBe(false);
    fireEvent.click(trigger);
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
