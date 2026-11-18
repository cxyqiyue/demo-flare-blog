import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { isFlare } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";

export function ErrorPage({ error: _error }: { error?: unknown }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [failed, setFailed] = useState(false);
  const onReset = async () => {
    setRetrying(true);
    setFailed(false);
    try {
      await router.invalidate();
    } catch {
      setFailed(true);
    } finally {
      setRetrying(false);
    }
  };
  if (isFlare)
    return (
      <section className="flare-surface mx-auto flex min-h-80 w-full max-w-2xl flex-col items-center justify-center gap-5 p-6 text-center sm:p-10">
        <h1 className="text-2xl font-bold">{m.error_title()}</h1>
        <p className="max-w-md text-base leading-7 text-muted-foreground">
          {m.error_desc()}
        </p>
        {failed ? (
          <p role="status" className="text-sm text-destructive">
            {m.error_retry_failed()}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            disabled={retrying}
            onClick={onReset}
            className="min-h-11 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {retrying ? m.error_retrying() : m.error_retry()}
          </button>
          <Link to="/" className="flare-chip min-h-11">
            {m.not_found_return()}
          </Link>
        </div>
      </section>
    );
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full p-4 md:p-8">
      <div className="w-full max-w-xl flex flex-col items-center text-center space-y-12 animate-in fade-in duration-700">
        <div className="space-y-6">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-muted-foreground/60">
            [ ERROR ]
          </p>
          <h2 className="text-2xl md:text-3xl font-serif font-medium tracking-tight">
            {m.error_title()}
          </h2>
          <p className="text-sm text-muted-foreground/70 font-light leading-relaxed max-w-md mx-auto">
            {m.error_desc()}
          </p>
        </div>

        <button
          onClick={onReset}
          className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-colors duration-300 gap-2 flex"
        >
          <span>[</span>
          <span>{m.error_retry()}</span>
          <span>]</span>
        </button>
      </div>
    </div>
  );
}
