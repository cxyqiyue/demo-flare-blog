import type { JSONContent } from "@tiptap/react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import clsx from "clsx";
import { Bold, Code, Image as ImageIcon, Italic, Link as LinkIcon, Loader2, Redo, Send, Strikethrough, Underline as UnderlineIcon, Undo } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { getMomentExtensions } from "@/features/moments/components/moment-editor-config";
import { m } from "@/paraglide/messages";

interface MomentEditorProps {
  onSubmit: (content: JSONContent) => Promise<boolean>;
  isSubmitting?: boolean;
  onCancel?: () => void;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  icon: LucideIcon;
  label?: string;
}

const ToolbarButton = ({
  onClick,
  isActive,
  icon: Icon,
  label,
}: ToolbarButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    className={clsx(
      "p-1.5 shrink-0 rounded-sm transition-all duration-200 flex items-center justify-center",
      isActive
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
    )}
  >
    <Icon size={14} />
  </button>
);

export function MomentEditor({
  onSubmit,
  isSubmitting,
  onCancel,
}: MomentEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: getMomentExtensions(),
    content: "",
    autofocus: "end",
    editorProps: {
      attributes: {
        class:
          "min-h-[120px] w-full bg-transparent py-3 text-sm leading-relaxed text-foreground focus:outline-none placeholder:text-muted-foreground/30 max-w-none",
      },
    },
  });

  const { isEmpty, isBold, isItalic, isUnderline, isStrike, isCode, isLink } =
    useEditorState({
      editor,
      selector: (ctx) => ({
        isEmpty: ctx.editor.isEmpty,
        isBold: ctx.editor.isActive("bold"),
        isItalic: ctx.editor.isActive("italic"),
        isUnderline: ctx.editor.isActive("underline"),
        isStrike: ctx.editor.isActive("strike"),
        isCode: ctx.editor.isActive("code"),
        isLink: ctx.editor.isActive("link"),
      }),
    });

  const insertLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(m.comments_editor_modal_link_label(), previousUrl ?? "");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
  }, [editor]);

  const pickImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file && editor) {
        editor.commands.uploadImage(file);
      }
    },
    [editor],
  );

  const handleSubmit = async () => {
    if (!editor || isEmpty || isSubmitting) return;
    const ok = await onSubmit(editor.getJSON());
    if (ok) {
      editor.commands.clearContent();
    }
  };

  return (
    <div className="relative border border-border/20 bg-muted/5 rounded-sm transition-colors duration-300 hover:border-border/40 focus-within:border-border/50 focus-within:bg-background overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex flex-wrap items-center gap-1 p-1.5 border-b border-border/10 bg-background/50">
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBold().run()}
          isActive={isBold}
          icon={Bold}
          label={m.comments_editor_toolbar_bold()}
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          isActive={isItalic}
          icon={Italic}
          label={m.comments_editor_toolbar_italic()}
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          isActive={isUnderline}
          icon={UnderlineIcon}
          label={m.comments_editor_toolbar_underline()}
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          isActive={isStrike}
          icon={Strikethrough}
          label={m.comments_editor_toolbar_strike()}
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleCode().run()}
          isActive={isCode}
          icon={Code}
          label={m.comments_editor_toolbar_code()}
        />

        <div className="h-4 w-px bg-border/20 mx-1" />

        <ToolbarButton
          onClick={insertLink}
          isActive={isLink}
          icon={LinkIcon}
          label={m.comments_editor_toolbar_link()}
        />
        <ToolbarButton
          onClick={pickImage}
          icon={ImageIcon}
          label={m.comments_editor_toolbar_image()}
        />

        <div className="ml-auto flex gap-0.5">
          <ToolbarButton
            onClick={() => editor?.chain().focus().undo().run()}
            icon={Undo}
            label={m.comments_editor_toolbar_undo()}
          />
          <ToolbarButton
            onClick={() => editor?.chain().focus().redo().run()}
            icon={Redo}
            label={m.comments_editor_toolbar_redo()}
          />
        </div>
      </div>

      <EditorContent editor={editor} className="w-full px-4 py-2" />

      <div className="flex items-center justify-between px-4 pb-2 pt-2 border-t border-border/10">
        <div className="text-[10px] font-mono text-muted-foreground/30 tracking-widest pl-2">
          {m.comments_editor_support_markdown()}
        </div>
        <div className="flex items-center gap-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-[10px] uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              {m.comments_editor_cancel()}
            </button>
          )}
          <Button
            size="sm"
            disabled={isEmpty || isSubmitting}
            onClick={handleSubmit}
            className="h-8 px-4 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
          >
            <span>
              {isSubmitting
                ? m.moments_composer_publishing()
                : m.moments_composer_submit()}
            </span>
            {isSubmitting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Send size={12} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
