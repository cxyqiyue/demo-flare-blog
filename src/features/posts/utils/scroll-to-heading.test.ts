import { afterEach, describe, expect, it, vi } from "vitest";
import { scrollToHeadingWithRetry } from "@/features/posts/utils/scroll-to-heading";

type StubWindow = {
  scrollY: number;
  scrollTo: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
};

function stubWindow(initialY: number) {
  const win: StubWindow = {
    scrollY: initialY,
    scrollTo: vi.fn((opts: ScrollToOptions) => {
      if (typeof opts.top === "number") win.scrollY = opts.top;
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setTimeout: ((...args: Parameters<typeof setTimeout>) =>
      globalThis.setTimeout(
        ...args,
      )) as typeof setTimeout,
    clearTimeout: ((id: ReturnType<typeof setTimeout>) =>
      globalThis.clearTimeout(id)) as typeof clearTimeout,
  };
  vi.stubGlobal("window", win);
  return win;
}

function makeElement(topGetter: () => number) {
  return {
    getBoundingClientRect: () => ({
      top: topGetter(),
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: topGetter(),
      toJSON: () => ({}),
    }),
  } as unknown as HTMLElement;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("scrollToHeadingWithRetry", () => {
  it("scrolls once and stops when the target is reached", () => {
    vi.useFakeTimers();
    const win = stubWindow(0);
    // element top fixed relative to document: after scroll, viewport-relative
    // top = docTop - scrollY
    const docTop = 5000;
    const el = makeElement(() => docTop - win.scrollY);

    scrollToHeadingWithRetry(el, 80);
    expect(win.scrollTo).toHaveBeenCalledTimes(1);
    expect(win.scrollY).toBe(4920);

    vi.advanceTimersByTime(3000);
    expect(win.scrollTo).toHaveBeenCalledTimes(1);
  });

  it("retries when layout growth interrupts the smooth scroll", () => {
    vi.useFakeTimers();
    const win = stubWindow(0);
    // simulate aborted smooth scroll: scroll never moves
    win.scrollTo = vi.fn(() => {});
    const el = makeElement(() => 5000);

    scrollToHeadingWithRetry(el, 80);
    vi.advanceTimersByTime(20000);

    // 1 initial + 4 retries, then gives up
    expect(win.scrollTo).toHaveBeenCalledTimes(5);
  });

  it("cancels retries when the user scrolls", () => {
    vi.useFakeTimers();
    const win = stubWindow(0);
    win.scrollTo = vi.fn(() => {});
    const el = makeElement(() => 5000);

    scrollToHeadingWithRetry(el, 80);
    // user wheel triggers the registered cancel handler
    const wheelHandler = win.addEventListener.mock.calls.find(
      (c) => c[0] === "wheel",
    )?.[1] as () => void;
    expect(typeof wheelHandler).toBe("function");
    wheelHandler();

    vi.advanceTimersByTime(20000);
    expect(win.scrollTo).toHaveBeenCalledTimes(1);
    expect(win.removeEventListener).toHaveBeenCalled();
  });
});