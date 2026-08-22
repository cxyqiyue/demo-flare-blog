import type { LucideIcon } from "lucide-react";
import {
  Bold,
  Code,
  CodeXml,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Sigma,
  Strikethrough,
  Table,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/features/about/components/markdown-content";
import { uploadEditorImage } from "@/features/image-hosting/utils/upload-editor-image";
import { handleServerError } from "@/lib/errors/error-handler";
import { parseRequestError } from "@/lib/errors/request-errors";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

interface AboutMarkdownEditorProps {
  initialTitle: string;
  initialMarkdown: string;
  isSubmitting?: boolean;
  previewClassName?: string;
  onSubmit: (title: string, markdown: string) => Promise<boolean>;
  onCancel?: () => void;
}

interface Selection {
  start: number;
  end: number;
}

interface InsertResult {
  next: string;
  selStart: number;
  selEnd: number;
}

type InsertFn = (value: string, sel: Selection) => InsertResult;

interface ToolbarAction {
  icon: LucideIcon;
  label: string;
  run: InsertFn;
}

const SEL_START = "\u0000S\u0000";
const SEL_END = "\u0000E\u0000";

function lineRange(value: string, start: number, end: number) {
  const ls = value.lastIndexOf("\n", start - 1) + 1;
  const nl = value.indexOf("\n", end);
  const le = nl === -1 ? value.length : nl;
  return { ls, le };
}

function wrapInline(marker: string, placeholder: string): InsertFn {
  return (value, sel) => {
    const selected = value.slice(sel.start, sel.end);
    if (selected) {
      const next = `${value.slice(0, sel.start)}${marker}${selected}${marker}${value.slice(sel.end)}`;
      return {
        next,
        selStart: sel.start + marker.length,
        selEnd: sel.start + marker.length + selected.length,
      };
    }
    const next = `${value.slice(0, sel.start)}${marker}${placeholder}${marker}${value.slice(sel.end)}`;
    return {
      next,
      selStart: sel.start + marker.length,
      selEnd: sel.start + marker.length + placeholder.length,
    };
  };
}

function prefixLine(prefix: string): InsertFn {
  return (value, sel) => {
    const { ls, le } = lineRange(value, sel.start, sel.end);
    const line = value.slice(ls, le);
    const next = `${value.slice(0, ls)}${prefix}${line}${value.slice(le)}`;
    return {
      next,
      selStart: ls + prefix.length,
      selEnd: ls + prefix.length + line.length,
    };
  };
}

function setHeading(level: number): InsertFn {
  return (value, sel) => {
    const { ls, le } = lineRange(value, sel.start, sel.end);
    const line = value.slice(ls, le);
    const marker = "#".repeat(level);
    const match = line.match(/^(#{1,6})\s+(.*)$/);
    let nextLine: string;
    if (match && match[1].length === level) {
      nextLine = match[2];
    } else if (match) {
      nextLine = `${marker} ${match[2]}`;
    } else {
      nextLine = `${marker} ${line}`;
    }
    const next = `${value.slice(0, ls)}${nextLine}${value.slice(le)}`;
    return {
      next,
      selStart: ls + nextLine.length,
      selEnd: ls + nextLine.length,
    };
  };
}

function insertTemplate(template: string): InsertFn {
  return (value, sel) => {
    const { ls } = lineRange(value, sel.start, sel.end);
    const before = value.slice(0, ls);
    const after = value.slice(sel.end);
    let next = `${before}${template}${after}`;
    const sIdx = next.indexOf(SEL_START);
    const eIdx = next.indexOf(SEL_END);
    if (sIdx !== -1 && eIdx !== -1 && eIdx > sIdx) {
      next = `${next.slice(0, sIdx)}${next.slice(sIdx + SEL_START.length, eIdx)}${next.slice(eIdx + SEL_END.length)}`;
      const selEnd = sIdx + (eIdx - sIdx - SEL_START.length);
      return { next, selStart: sIdx, selEnd };
    }
    const caret = before.length + template.length;
    return { next, selStart: caret, selEnd: caret };
  };
}

export function AboutMarkdownEditor({
  initialTitle,
  initialMarkdown,
  isSubmitting = false,
  previewClassName,
  onSubmit,
  onCancel,
}: AboutMarkdownEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [pendingSel, setPendingSel] = useState<Selection | null>(null);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pendingSel && taRef.current) {
      taRef.current.setSelectionRange(pendingSel.start, pendingSel.end);
      taRef.current.focus();
      setPendingSel(null);
    }
  }, [pendingSel]);

  const handleImageFilesChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0 || tab !== "write") return;
    const ta = taRef.current;
    const value = ta?.value ?? markdown;
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? value.length;

    setIsUploadingImages(true);
    try {
      const snippets: string[] = [];
      for (const file of files) {
        try {
          const result = await uploadEditorImage(file);
          const alt = file.name.replace(/\.[^.]+$/, "");
          snippets.push(`![${alt}](${result.url})`);
        } catch (error) {
          const parsed = parseRequestError(error);
          if (parsed.code === "UNKNOWN") {
            toast.error(m.editor_image_upload_failed(), {
              description: parsed.message,
            });
          } else {
            handleServerError(error);
          }
        }
      }
      if (snippets.length > 0) {
        const insertText = `${snippets.join("\n")}\n`;
        const next = `${value.slice(0, start)}${insertText}${value.slice(end)}`;
        setMarkdown(next);
        const caret = start + insertText.length;
        setPendingSel({ start: caret, end: caret });
      }
    } finally {
      setIsUploadingImages(false);
    }
  };

  const applyAction = (action: ToolbarAction) => {
    if (tab !== "write") return;
    const ta = taRef.current;
    const value = ta?.value ?? markdown;
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? value.length;
    const result = action.run(value, { start, end });
    setMarkdown(result.next);
    setPendingSel({ start: result.selStart, end: result.selEnd });
  };

  const tableTemplate = `| ${SEL_START}${m.about_editor_ph_table_header()}${SEL_END} | ${m.about_editor_ph_table_header()} |\n| --- | --- |\n| ${m.about_editor_ph_table_cell()} | ${m.about_editor_ph_table_cell()} |\n\n`;

  const actions: Array<ToolbarAction> = [
    {
      icon: Bold,
      label: m.about_editor_bold(),
      run: wrapInline("**", m.about_editor_ph_bold()),
    },
    {
      icon: Italic,
      label: m.about_editor_italic(),
      run: wrapInline("*", m.about_editor_ph_italic()),
    },
    {
      icon: Strikethrough,
      label: m.about_editor_strike(),
      run: wrapInline("~~", m.about_editor_ph_strike()),
    },
    { icon: Heading1, label: m.about_editor_h1(), run: setHeading(1) },
    { icon: Heading2, label: m.about_editor_h2(), run: setHeading(2) },
    { icon: Heading3, label: m.about_editor_h3(), run: setHeading(3) },
    { icon: Quote, label: m.about_editor_quote(), run: prefixLine("> ") },
    {
      icon: Code,
      label: m.about_editor_inline_code(),
      run: wrapInline("`", "code"),
    },
    {
      icon: CodeXml,
      label: m.about_editor_code_block(),
      run: insertTemplate("```\n\n```\n"),
    },
    {
      icon: LinkIcon,
      label: m.about_editor_link(),
      run: insertTemplate(
        `[${SEL_START}${m.about_editor_ph_link()}${SEL_END}](https://)\n`,
      ),
    },
    {
      icon: ImageIcon,
      label: m.about_editor_image(),
      run: insertTemplate(
        `![${SEL_START}${m.about_editor_ph_image()}${SEL_END}](https://)\n`,
      ),
    },
    {
      icon: ImagePlus,
      label: m.about_editor_image_upload(),
      run: (value, sel) => {
        if (!isUploadingImages) {
          imageInputRef.current?.click();
        }
        return { next: value, selStart: sel.start, selEnd: sel.end };
      },
    },
    { icon: List, label: m.about_editor_bullet_list(), run: prefixLine("- ") },
    {
      icon: ListOrdered,
      label: m.about_editor_ordered_list(),
      run: prefixLine("1. "),
    },
    {
      icon: ListChecks,
      label: m.about_editor_task_list(),
      run: prefixLine("- [ ] "),
    },
    {
      icon: Table,
      label: m.about_editor_table(),
      run: insertTemplate(tableTemplate),
    },
    { icon: Minus, label: m.about_editor_hr(), run: prefixLine("---") },
    {
      icon: Sigma,
      label: m.about_editor_math(),
      run: (value, sel) => {
        const selected = value.slice(sel.start, sel.end);
        const marker = selected.includes("\n") ? "$$" : "$";
        return wrapInline(marker, m.about_editor_ph_math())(value, sel);
      },
    },
  ];

  const handleSave = async () => {
    if (isSubmitting) return;
    await onSubmit(title, markdown);
  };

  return (
    <div className="w-full max-w-3xl mx-auto pb-20 px-6 md:px-0 pt-10 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={m.about_editor_title_placeholder()}
          className="flex-1 min-w-0 bg-transparent border-b border-border/40 pb-2 text-xl md:text-2xl font-serif font-medium tracking-tight focus:outline-none focus:border-foreground/60 transition-colors"
        />
        <div className="flex items-center gap-2 shrink-0">
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              {m.about_cancel()}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>{m.about_save()}</>
            )}
          </Button>
        </div>
      </div>

      <div className="border border-border/40 rounded-lg overflow-hidden bg-muted/20">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          className="hidden"
          multiple
          onChange={handleImageFilesChange}
        />
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/40">
          <div className="flex flex-wrap items-center gap-0.5">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                title={action.label}
                aria-label={action.label}
                onClick={() => applyAction(action)}
                className="p-1.5 shrink-0 rounded-sm transition-all duration-200 flex items-center justify-center text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              >
                <action.icon size={15} />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 ml-2 shrink-0">
            <button
              type="button"
              onClick={() => setTab("write")}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs transition-colors",
                tab === "write"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m.about_editor_tab_write()}
            </button>
            <button
              type="button"
              onClick={() => setTab("preview")}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs transition-colors",
                tab === "preview"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m.about_editor_tab_preview()}
            </button>
          </div>
        </div>

        {tab === "write" ? (
          <textarea
            ref={taRef}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder={m.about_editor_placeholder()}
            spellCheck={false}
            className="w-full min-h-[50vh] bg-transparent p-4 font-mono text-sm leading-relaxed resize-y focus:outline-none text-foreground placeholder:text-muted-foreground/60"
          />
        ) : (
          <div className="p-4 md:p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <MarkdownContent markdown={markdown} className={previewClassName} />
          </div>
        )}
      </div>
    </div>
  );
}
