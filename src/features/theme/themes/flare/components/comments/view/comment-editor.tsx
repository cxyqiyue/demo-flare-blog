import type { JSONContent, Editor as TiptapEditor } from "@tiptap/react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { FileText, Loader2, Send } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getCommentExtensions } from "@/features/comments/components/editor/config";
import { useCommentImageUploader } from "@/features/image-hosting/hooks/use-comment-image-upload";
import { normalizeLinkHref } from "@/lib/links/normalize-link-href";
import { useMarkdownMode } from "@/lib/markdown/markdown-mode";
import { createMarkdownPasteHandler } from "@/lib/markdown/markdown-paste-handler";
import { m } from "@/paraglide/messages";
import CommentEditorToolbar from "../editor/comment-editor-toolbar";
import type { ModalType } from "../editor/comment-insert-modal";
import InsertModal from "../editor/comment-insert-modal";

interface CommentEditorProps {
  onSubmit: (content: JSONContent) => Promise<boolean | undefined>;
  isSubmitting?: boolean;
  autoFocus?: boolean;
  onCancel?: () => void;
  submitLabel?: string;
}

export const CommentEditor = ({
  onSubmit,
  isSubmitting,
  autoFocus,
  onCancel,
  submitLabel,
}: CommentEditorProps) => {
  const actualSubmitLabel = submitLabel || m.comments_editor_submit();

  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalInitialUrl, setModalInitialUrl] = useState("");

  const markdownMode = useMarkdownMode();
  const { mode, markdownText, setMarkdownText, converting } = markdownMode;

  const editorRef = useRef<TiptapEditor | null>(null);
  const handlePaste = useCallback(
    createMarkdownPasteHandler(() => editorRef.current),
    [],
  );

  const editor = useEditor({
    extensions: getCommentExtensions(),
    content: "",
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      handlePaste,
      attributes: {
        class:
          "min-h-[80px] w-full bg-transparent py-2 text-sm focus:outline-none placeholder:text-muted-foreground/30 max-w-none",
      },
    },
  });
  editorRef.current = editor;

  const { isEmpty } = useEditorState({
    editor,
    selector: (ctx) => ({
      isEmpty: ctx.editor.isEmpty,
    }),
  });

  const { enabled: imageHostingEnabled, openUpload } =
    useCommentImageUploader();

  const openLinkModal = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    setModalInitialUrl(previousUrl || "");
    setModalType("LINK");
  }, [editor]);

  const openImageModal = useCallback(() => {
    if (imageHostingEnabled) {
      // 第三方图床已启用：打开官方上传弹窗
      void openUpload().then((urls) => {
        for (const url of urls) {
          editor?.chain().focus().setImage({ src: url }).run();
        }
      });
      return;
    }
    setModalInitialUrl("");
    setModalType("IMAGE");
  }, [editor, imageHostingEnabled, openUpload]);

  const handleToggleMode = () => {
    if (converting) return;
    if (mode === "markdown") {
      void markdownMode.switchToRich().then((json) => {
        if (json && editor) editor.commands.setContent(json);
      });
    } else {
      markdownMode.switchToMarkdown(editor ? editor.getJSON() : null);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || converting) return;
    if (mode === "markdown") {
      if (!markdownText.trim()) return;
      try {
        const success = await markdownMode.submitInMarkdown(onSubmit);
        if (success !== false) {
          editorRef.current?.commands.clearContent();
        }
      } catch {
        // Error handled by parent hook
      }
      return;
    }
    if (isEmpty || isSubmitting) return;

    try {
      const success = await onSubmit(editor.getJSON());
      // 仅在提交成功后清空内容；失败时保留以便用户重试
      if (success !== false) {
        editor.commands.clearContent();
      }
    } catch (error) {
      // Error handled by parent hook
    }
  };

  return (
    <div className="relative group/editor border border-border/10 rounded-sm bg-muted/5 transition-colors duration-300 hover:border-border/30 focus-within:border-border/50 focus-within:bg-background overflow-hidden">
      {mode === "rich" ? (
        <>
          {/* Toolbar - Always visible at top */}
          <div className="border-b border-border/10 p-1 bg-background/50 backdrop-blur-sm sticky top-0 z-10 w-full">
            <CommentEditorToolbar
              editor={editor}
              onLinkClick={openLinkModal}
              onImageClick={openImageModal}
              onToggleMarkdown={handleToggleMode}
            />
          </div>

          <EditorContent
            editor={editor}
            className="min-h-25 w-full px-4 py-3"
          />
        </>
      ) : (
        <>
          {/* Markdown toolbar */}
          <div className="flex flex-wrap items-center gap-1 p-1 border-b border-border/10 bg-background/50 backdrop-blur-sm sticky top-0 z-10 w-full">
            <button
              onClick={handleToggleMode}
              title={m.editor_mode_rich()}
              type="button"
              className="p-1.5 shrink-0 rounded-sm transition-all duration-200 text-muted-foreground hover:bg-muted/50 hover:text-foreground flex items-center justify-center"
            >
              <FileText size={14} />
            </button>
            <span className="text-[10px] font-mono text-muted-foreground/40 tracking-widest uppercase">
              {m.editor_mode_markdown()}
            </span>
          </div>
          <textarea
            value={markdownText}
            onChange={(event) => setMarkdownText(event.target.value)}
            placeholder={m.comments_editor_placeholder()}
            spellCheck={false}
            className="min-h-[80px] w-full bg-transparent px-4 py-3 text-sm leading-relaxed text-foreground focus:outline-none placeholder:text-muted-foreground/30 max-w-none font-mono resize-y"
          />
        </>
      )}

      <div className="flex items-center justify-between px-4 pb-2 pt-2 border-t border-border/10">
        <div className="text-[10px] font-mono text-muted-foreground/30 tracking-widest pl-2">
          {m.comments_editor_support_markdown()}
        </div>
        <div className="flex items-center gap-4">
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-[10px] uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              {m.comments_editor_cancel()}
            </button>
          )}
          <Button
            size="sm"
            disabled={
              (mode === "markdown" ? !markdownText.trim() : isEmpty) ||
              isSubmitting ||
              converting
            }
            onClick={handleSubmit}
            variant="ghost"
            className="h-8 px-4 text-[10px] font-bold uppercase tracking-widest hover:bg-transparent hover:text-foreground p-0 flex items-center gap-2 group/btn"
          >
            <span>
              {isSubmitting || converting
                ? m.comments_editor_submitting()
                : actualSubmitLabel}
            </span>
            {isSubmitting || converting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Send
                size={12}
                className="group-hover/btn:translate-x-0.5 transition-transform"
              />
            )}
          </Button>
        </div>
      </div>

      <InsertModal
        type={modalType}
        initialUrl={modalInitialUrl}
        onClose={() => setModalType(null)}
        onSubmit={(url, attrs) => {
          if (modalType === "LINK") {
            const href = normalizeLinkHref(url);
            if (href === "") {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
            } else {
              editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href })
                .run();
            }
          } else if (modalType === "IMAGE") {
            editor
              .chain()
              .focus()
              .setImage({ src: url, ...attrs })
              .run();
          }
          setModalType(null);
        }}
      />
    </div>
  );
};
