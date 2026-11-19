// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Turnstile } from "./turnstile";

afterEach(() => {
  cleanup();
  delete window.turnstile;
});

describe("Turnstile widget lifecycle", () => {
  it("keeps the widget mounted when callback identities change", async () => {
    const widget = {
      render: vi.fn(
        (_container: HTMLElement, _options: Record<string, unknown>) =>
          "widget-1",
      ),
      reset: vi.fn(),
      remove: vi.fn(),
    };
    window.turnstile = widget;

    const view = render(
      createElement(Turnstile, {
        siteKey: "site-key",
        action: "login",
        onVerify: () => {},
        onError: () => {},
        onExpire: () => {},
      }),
    );
    await vi.waitFor(() => expect(widget.render).toHaveBeenCalledTimes(1));

    const onVerify = vi.fn();
    const onError = vi.fn();
    const onExpire = vi.fn();
    view.rerender(
      createElement(Turnstile, {
        siteKey: "site-key",
        action: "login",
        onVerify,
        onError,
        onExpire,
      }),
    );

    expect(widget.render).toHaveBeenCalledTimes(1);
    expect(widget.remove).not.toHaveBeenCalled();
    const options = widget.render.mock.calls[0][1];
    (options.callback as (token: string) => void)("verified-token");
    (options["error-callback"] as () => void)();
    (options["expired-callback"] as () => void)();
    expect(onVerify).toHaveBeenCalledWith("verified-token");
    expect(onError).toHaveBeenCalledOnce();
    expect(onExpire).toHaveBeenCalledOnce();
    view.unmount();
    expect(widget.remove).toHaveBeenCalledWith("widget-1");
  });
});
