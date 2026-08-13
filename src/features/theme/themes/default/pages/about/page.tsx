import { ArrowLeft, FileQuestion, Pencil } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { AboutPageProps } from "@/features/theme/contract/pages";
import { MarkdownContent } from "@/features/about/components/markdown-content";
import { m } from "@/paraglide/messages";

export function AboutPage({ article, isAdmin, onStartEdit }: AboutPageProps) {
  const navigate = useNavigate();

  if (!article) {
    return (
      <div className="w-full max-w-3xl mx-auto pb-20 px-6 md:px-0">
        <div className="py-16 md:py-24 flex flex-col items-center text-center">
          <div className="mb-6 w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center">
            <FileQuestion size={22} className="text-muted-foreground/60" />
          </div>
          <h1 className="text-2xl md:text-3xl font-serif font-medium tracking-tight text-foreground mb-3">
            {m.about_empty_title()}
          </h1>
          <p className="max-w-md text-sm font-light text-muted-foreground leading-relaxed mb-8">
            {m.about_empty_desc()}
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={onStartEdit}
              className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-medium text-muted-foreground hover:text-foreground transition-colors border border-border rounded-full px-5 py-2.5 hover:border-foreground/40"
            >
              <Pencil size={13} />
              <span>{m.about_admin_create()}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto pb-20 px-6 md:px-0">
      <nav className="py-12 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/posts" })}
          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-opacity"
        >
          <ArrowLeft size={12} />
          <span>{m.post_back_to_list()}</span>
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={onStartEdit}
            className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground opacity-60 hover:opacity-100 transition-opacity"
          >
            <Pencil size={12} />
            <span>{m.about_edit()}</span>
          </button>
        )}
      </nav>

      <article className="space-y-16">
        {article.title ? (
          <header className="space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-medium leading-[1.1] tracking-tight text-foreground">
              {article.title}
            </h1>
          </header>
        ) : null}

        <main className="max-w-none min-w-0 overflow-x-clip text-foreground leading-relaxed font-serif">
          <MarkdownContent markdown={article.markdown} className="default-md" />
        </main>
      </article>
    </div>
  );
}
