import type { JSONContent, Editor as TiptapEditor } from "@tiptap/react";
import { Check, Loader2, Sparkles, Wand2, X, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateArticleFn } from "@/features/posts/api/posts.admin.api";
import { ContentRenderer } from "@/features/theme/themes/default/components/content/content-renderer";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

interface AiArticlePanelProps {
  editor: TiptapEditor | null;
  open: boolean;
  onClose: () => void;
  onApplyTitle: (title: string) => void;
}

export function AiArticlePanel({
  editor,
  open,
  onClose,
  onApplyTitle,
}: AiArticlePanelProps) {
  const [outline, setOutline] = useState("");
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("");
  const [tone, setTone] = useState("");
  const [fillTitle, setFillTitle] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "markdown">("preview");
  const [generated, setGenerated] = useState<{
    markdown: string;
    content: JSONContent;
  } | null>(null);

  const canGenerate = outline.trim().length > 0 && !isGenerating;

  const handleInputChange = () => {
    setGenerated(null);
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setGenerated(null);

    try {
      const result = await generateArticleFn({
        data: {
          outline: outline.trim(),
          title: title.trim() || undefined,
          language: language.trim() || undefined,
          tone: tone.trim() || undefined,
        },
      });

      setGenerated(result);
      setViewMode("preview");
    } catch (error) {
      toast.error(m.editor_ai_generate_error(), {
        description:
          error instanceof Error ? error.message : m.editor_ai_unknown_error(),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsert = () => {
    if (!generated || !editor) return;
    editor.commands.setContent(generated.content);
    if (fillTitle && title.trim()) {
      onApplyTitle(title.trim());
    }
    toast.success(m.editor_ai_insert_success());
    onClose();
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-90 bg-black/30 animate-in fade-in duration-300"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed right-0 top-0 bottom-0 z-100 w-full max-w-xl bg-background border-l border-border/30 shadow-2xl transition-transform duration-500 ease-out flex flex-col",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-sm bg-muted/40 p-2">
              <Sparkles size={16} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {m.editor_ai_panel_title()}
              </p>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {m.editor_ai_panel_eyebrow()}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-none text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 space-y-8">
          {/* Outline */}
          <div className="space-y-3">
            <label
              htmlFor="ai-outline"
              className="text-sm text-muted-foreground"
            >
              {m.editor_ai_outline_label()}
            </label>
            <Textarea
              id="ai-outline"
              value={outline}
              onChange={(e) => {
                setOutline(e.target.value);
                handleInputChange();
              }}
              placeholder={m.editor_ai_outline_ph()}
              rows={8}
              className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-4 text-sm leading-relaxed text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
            />
          </div>

          {/* Optional fields */}
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <div className="space-y-3">
              <label
                htmlFor="ai-title"
                className="text-sm text-muted-foreground"
              >
                {m.editor_ai_title_label()}
              </label>
              <Input
                id="ai-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  handleInputChange();
                }}
                placeholder={m.editor_ai_title_ph()}
                className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-4 text-sm transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
              />
            </div>

            <div className="space-y-3">
              <label
                htmlFor="ai-language"
                className="text-sm text-muted-foreground"
              >
                {m.editor_ai_language_label()}
              </label>
              <Input
                id="ai-language"
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  handleInputChange();
                }}
                placeholder={m.editor_ai_language_ph()}
                className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-4 text-sm transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
              />
            </div>

            <div className="space-y-3 md:col-span-2">
              <label
                htmlFor="ai-tone"
                className="text-sm text-muted-foreground"
              >
                {m.editor_ai_tone_label()}
              </label>
              <Input
                id="ai-tone"
                value={tone}
                onChange={(e) => {
                  setTone(e.target.value);
                  handleInputChange();
                }}
                placeholder={m.editor_ai_tone_ph()}
                className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-4 text-sm transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
              />
            </div>
          </div>

          {/* Generate button */}
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full h-11 rounded-none bg-foreground text-background hover:bg-foreground/90 transition-all font-mono text-[11px] uppercase tracking-[0.2em] disabled:opacity-40"
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} className="mr-3 animate-spin" />
                {m.editor_ai_generating()}
              </>
            ) : (
              <>
                <Wand2 size={14} className="mr-3" />
                {m.editor_ai_generate_btn()}
              </>
            )}
          </Button>

          {/* Result */}
          {generated && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center justify-between border-b border-border/30 pb-3">
                <div className="flex items-center gap-4">
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                    {m.editor_ai_result_label()}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setViewMode("preview")}
                      className={cn(
                        "px-2 py-1 text-[9px] font-mono uppercase tracking-widest transition-colors",
                        viewMode === "preview"
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {m.editor_ai_view_preview()}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("markdown")}
                      className={cn(
                        "px-2 py-1 text-[9px] font-mono uppercase tracking-widest transition-colors",
                        viewMode === "markdown"
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {m.editor_ai_view_markdown()}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {generated.markdown.length} {m.editor_ai_result_chars()}
                  </span>
                </div>
              </div>

              {viewMode === "markdown" ? (
                <pre className="max-h-80 overflow-y-auto custom-scrollbar whitespace-pre-wrap break-words border border-border/20 bg-muted/10 p-4 text-xs leading-6 text-foreground/80">
                  {generated.markdown}
                </pre>
              ) : (
                <div className="max-h-96 overflow-y-auto custom-scrollbar border border-border/20 bg-muted/5 px-6 py-6">
                  <ContentRenderer content={generated.content} />
                </div>
              )}

              <label className="flex cursor-pointer items-center gap-3 py-2">
                <input
                  type="checkbox"
                  checked={fillTitle}
                  onChange={(e) => setFillTitle(e.target.checked)}
                  className="h-3.5 w-3.5 rounded-none border-border/60 accent-foreground"
                />
                <span className="text-xs text-muted-foreground">
                  {m.editor_ai_fill_title()}
                </span>
              </label>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setGenerated(null)}
                  className="h-11 flex-1 rounded-none border-border/50 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  <XCircle size={12} className="mr-2" />
                  {m.editor_ai_discard()}
                </Button>
                <Button
                  type="button"
                  onClick={handleInsert}
                  className="h-11 flex-1 rounded-none bg-foreground text-background hover:bg-foreground/90 font-mono text-[10px] uppercase tracking-widest"
                >
                  <Check size={12} className="mr-2" />
                  {m.editor_ai_insert_btn()}
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
