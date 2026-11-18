import { Link, useNavigate } from "@tanstack/react-router";
import { isFlare } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";

export function NotFound() {
  const navigate = useNavigate();
  const onReturn = () => {
    navigate({ to: "/" });
  };

  if (isFlare)
    return (
      <section className="flare-surface mx-auto flex min-h-80 w-full max-w-2xl flex-col items-center justify-center gap-5 p-6 text-center sm:p-10">
        <span className="text-5xl font-bold tabular-nums text-primary/60">
          404
        </span>
        <h1 className="text-2xl font-bold">{m.not_found_title()}</h1>
        <p className="max-w-md text-base leading-7 text-muted-foreground">
          {m.not_found_desc()}
        </p>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          {m.not_found_return()}
        </Link>
      </section>
    );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full p-6 text-center bg-background">
      <div className="space-y-12 animate-in fade-in duration-700">
        <div className="space-y-6">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-muted-foreground/60">
            [ 404 ]
          </p>
          <h2 className="text-2xl md:text-3xl font-serif font-medium tracking-tight text-foreground">
            {m.not_found_title()}
          </h2>
          <p className="max-w-md mx-auto text-sm text-muted-foreground/70 font-light leading-relaxed">
            {m.not_found_desc()}
          </p>
        </div>

        <button
          onClick={onReturn}
          className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-colors duration-300"
        >
          <span>[</span>
          <span>{m.not_found_return()}</span>
          <span>]</span>
        </button>
      </div>
    </div>
  );
}
