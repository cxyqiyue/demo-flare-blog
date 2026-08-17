import { FileQuestion, Pencil } from "lucide-react";
import { MarkdownContent } from "@/features/about/components/markdown-content";
import type { AboutPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";
import { FuwariCommentSection } from "../../components/comments/view/comment-section";

const markdownClassName =
  "prose dark:prose-invert prose-base max-w-none! fuwari-custom-md";

export function AboutPage({ article, isAdmin, onStartEdit }: AboutPageProps) {
  if (!article) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <div
          className="fuwari-card-base p-12 md:p-16 flex flex-col items-center justify-center text-center fuwari-onload-animation"
          style={{ animationDelay: "150ms" }}
        >
          <div className="w-16 h-16 rounded-full bg-(--fuwari-btn-regular-bg) flex items-center justify-center mb-6 text-(--fuwari-btn-content)">
            <FileQuestion size={24} strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold fuwari-text-90 mb-3">
            {m.about_empty_title()}
          </h1>
          <p className="text-sm fuwari-text-50 max-w-sm leading-relaxed mb-8">
            {m.about_empty_desc()}
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={onStartEdit}
              className="fuwari-btn-regular rounded-lg h-10 px-6 flex items-center justify-center gap-2 text-sm"
            >
              <Pencil size={14} strokeWidth={1.5} />
              <span>{m.about_admin_create()}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="fuwari-card-base z-10 px-6 md:px-9 pt-6 pb-6 relative w-full fuwari-onload-animation">
        <div className="flex flex-row flex-wrap fuwari-text-30 gap-5 mb-3 transition">
          {isAdmin && (
            <button
              type="button"
              onClick={onStartEdit}
              className="flex flex-row items-center fuwari-text-30 hover:fuwari-text-90 transition animate-in fade-in duration-500"
            >
              <div className="transition h-6 w-6 rounded-md bg-black/5 dark:bg-white/10 fuwari-text-50 flex items-center justify-center mr-2">
                <Pencil strokeWidth={1.5} size={16} />
              </div>
              <div className="text-sm">{m.about_edit()}</div>
            </button>
          )}
        </div>

        {article.title ? (
          <h1 className="transition w-full block font-bold mb-6 text-3xl md:text-[2.25rem]/[2.75rem] fuwari-text-90">
            {article.title}
          </h1>
        ) : null}

        <MarkdownContent
          markdown={article.markdown}
          className={markdownClassName}
        />
      </div>

      {/* Comments Section (separate container) */}
      <div
        className="fuwari-card-base p-6 fuwari-onload-animation"
        style={{ animationDelay: "450ms" }}
      >
        <FuwariCommentSection aboutArticleId={article.id} />
      </div>
    </div>
  );
}
