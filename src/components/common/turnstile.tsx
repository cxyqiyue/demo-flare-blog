import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { clientEnv } from "@/lib/env/client.env";

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: Record<string, unknown>,
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  action?: string;
  widgetIdRef?: RefObject<string | null>;
  siteKey?: string;
}

export type { TurnstileProps };

let scriptLoadPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error("Failed to load Turnstile script"));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

export function Turnstile({
  onVerify,
  onError,
  onExpire,
  action,
  widgetIdRef: externalWidgetIdRef,
  siteKey: siteKeyProp,
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalWidgetIdRef = useRef<string | null>(null);

  const siteKey =
    siteKeyProp !== undefined
      ? siteKeyProp
      : clientEnv().VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let mounted = true;

    loadScript()
      .then(() => {
        if (!mounted || !containerRef.current || !window.turnstile) return;

        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: onVerify,
          "error-callback": onError,
          "expired-callback": onExpire,
          action,
          // 始终渲染 widget，避免 "interaction-only" 下无任何可见 UI
          appearance: "always",
        });
        internalWidgetIdRef.current = id;
        if (externalWidgetIdRef) {
          externalWidgetIdRef.current = id;
        }
      })
      .catch(() => {
        // Turnstile script failed to load — skip silently
      });

    return () => {
      mounted = false;
      if (internalWidgetIdRef.current && window.turnstile) {
        window.turnstile.remove(internalWidgetIdRef.current);
        internalWidgetIdRef.current = null;
        if (externalWidgetIdRef) {
          externalWidgetIdRef.current = null;
        }
      }
    };
  }, [siteKey, onVerify, onError, onExpire, action, externalWidgetIdRef]);

  if (!siteKey) return null;

  return <div ref={containerRef} />;
}

/**
 * Hook for using Turnstile in forms (client-side only).
 * Returns { isPending, token, turnstileProps } — spread turnstileProps onto <Turnstile />.
 * Use `isPending` to disable submit buttons until verification completes.
 * Use `token` in API request headers as `X-Turnstile-Token`.
 */
export function useTurnstile(action?: string, siteKey?: string) {
  const [token, setToken] = useState<string | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const effectiveSiteKey =
    siteKey !== undefined ? siteKey : clientEnv().VITE_TURNSTILE_SITE_KEY;

  const onVerify = useCallback((t: string) => {
    setToken(t);
  }, []);

  const onExpire = useCallback(() => {
    setToken(null);
  }, []);

  /** Reset the Turnstile widget to obtain a fresh token (tokens are single-use). */
  const reset = useCallback(() => {
    setToken(null);
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  return {
    /** Turnstile is configured but challenge not yet completed */
    isPending: !!effectiveSiteKey && !token,
    /** The Turnstile token to send in X-Turnstile-Token header */
    token,
    /** Reset the widget to get a fresh token after each API call */
    reset,
    turnstileProps: {
      onVerify,
      onExpire,
      action,
      widgetIdRef,
      siteKey: effectiveSiteKey,
    } satisfies TurnstileProps,
  };
}
