import { Link } from "@tanstack/react-router";
import { FileQuestion, Pencil } from "lucide-react";
import type { AboutPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";
import { PostPage } from "../post";

export function AboutPage({ post, isAdmin }: AboutPageProps) {
  if (!post) {
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
            <Link
              to="/admin/posts"
              className="fuwari-btn-regular rounded-lg h-10 px-6 flex items-center justify-center gap-2 text-sm"
            >
              <Pencil size={14} strokeWidth={1.5} />
              <span>{m.about_admin_create()}</span>
            </Link>
          )}
        </div>
      </div>
    );
  }

  return <PostPage post={post} />;
}
