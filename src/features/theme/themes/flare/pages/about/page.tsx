import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FileQuestion, Pencil } from "lucide-react";
import { MarkdownContent } from "@/features/about/components/markdown-content";
import type { AboutPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";
import { CommentSection } from "../../components/comments/view/comment-section";

export function AboutPage({ article, isAdmin, onStartEdit }: AboutPageProps) {
  const navigate = useNavigate();

  if (!article) {
    return (
      <div className="w-full flare-enter">
        <div className="flare-surface p-8 md:p-12 flex flex-col items-center text-center">
          <div className="mb-5 w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center border border-border/40">
            <FileQuestion size={22} className="text-muted-foreground/70" />
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-3">
            {m.about_empty_title()}
          </h1>
          <p className="max-w-md text-sm md:text-base text-muted-foreground leading-7 mb-7">
            {m.about_empty_desc()}
          </p>
          {isAdmin ? (
            <button type="button" onClick={onStartEdit} className="flare-chip">
              <Pencil size={14} />
              <span>{m.about_admin_create()}</span>
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flare-enter flex w-full flex-col gap-4">
      <nav className="flex items-center justify-between px-0.5">
        <button
          onClick={() => navigate({ to: "/posts" })}
          className="flare-chip"
        >
          <ArrowLeft size={14} />
          <span>{m.post_back_to_list()}</span>
        </button>
        {isAdmin ? (
          <button type="button" onClick={onStartEdit} className="flare-chip">
            <Pencil size={14} />
            <span>{m.about_edit()}</span>
          </button>
        ) : null}
      </nav>

      <article className="flare-surface p-5 md:p-8 lg:p-10 space-y-8">
        {article.title ? (
          <header>
            <h1 className="text-3xl md:text-5xl font-semibold leading-tight tracking-tight text-foreground">
              {article.title}
            </h1>
          </header>
        ) : null}
        <main className="max-w-none min-w-0 overflow-x-clip text-foreground leading-relaxed">
          <MarkdownContent
            markdown={article.markdown}
            preRenderedHtml={article.renderedHtml}
            className="flare-md"
          />
        </main>
      </article>

      <section className="flare-surface p-5 md:p-8">
        <CommentSection aboutArticleId={article.id} />
      </section>
    </div>
  );
}
