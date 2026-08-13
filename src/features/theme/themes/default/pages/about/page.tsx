import { FileQuestion, Pencil } from "lucide-react";
import type { AboutPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";
import { PostPage } from "../post";

export function AboutPage({ post, isAdmin, onStartEdit }: AboutPageProps) {
  if (!post) {
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

  return <PostPage post={post} hideAdminEdit />;
}
