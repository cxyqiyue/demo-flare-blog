import FileHandler from "@tiptap/extension-file-handler";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import clsx from "clsx";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListTodo,
  Loader2,
  Quote,
  Redo,
  Send,
  Strikethrough,
  Terminal,
  Underline as UnderlineIcon,
  Undo,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadToImageHostingFn } from "@/features/image-hosting/api/image-hosting.api";
import { uploadImageFn } from "@/features/media/api/media.api";
import { CodeBlockExtension } from "@/features/posts/editor/extensions/code-block";
import { ImageExtension } from "@/features/posts/editor/extensions/images";
import { BlockQuoteExtension } from "@/features/posts/editor/extensions/typography/block-quote";
import { HeadingExtension } from "@/features/posts/editor/extensions/typography/heading";
import type { ImageUploadResult } from "@/features/posts/editor/extensions/upload-image";
import { ImageUpload } from "@/features/posts/editor/extensions/upload-image";
import { m } from "@/paraglide/messages";
import type { JSONContent } from "@tiptap/react";

const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];

async function handleImageUpload(file: File): Promise<ImageUploadResult> {
  const formData = new FormData();
  formData.append("image", file);

  // 优先走第三方图床（服务端代理，API key 不接触浏览器）
  const hosted = await uploadToImageHostingFn({ data: formData });
  if (hosted.error) {
    throw new Error(m.image_hosting_upload_failed());
  }

  if (hosted.data.mode === "image-hosting") {
    toast.success(m.image_hosting_upload_success({ name: file.name }), {
      description: m.image_hosting_upload_success_desc({ name: file.name }),
    });
    return {
      url: hosted.data.url,
      width: hosted.data.width || undefined,
      height: hosted.data.height || undefined,
    };
  }

  // 未启用第三方图床时回退到默认存储 (R2)
  const result = await uploadImageFn({ data: formData });
  if (result.error) {
    throw new Error(m.media_upload_error_db());
  }
  toast.success(m.media_upload_success({ name: file.name }), {
    description: m.editor_image_upload_success_desc({ name: file.name }),
  });

  return {
    url: result.data.url,
    width: result.data.width || undefined,
    height: result.data.height || undefined,
  };
}

function handleFileDrop(editor: TiptapEditor, files: Array<File>, pos: number) {
  files.forEach((file) => {
    if (ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
      editor.commands.uploadImage(file, pos);
    }
  });
}

function handleFilePaste(editor: TiptapEditor, files: Array<File>) {
  files.forEach((file) => {
    if (ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
      editor.commands.uploadImage(file);
    }
  });
}

function getAboutEditorExtensions() {
  return [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      blockquote: false,
      code: {
        HTMLAttributes: {
          class:
            "font-mono text-sm px-1 text-foreground/80 bg-muted/40 rounded-sm",
          spellCheck: false,
        },
      },
      underline: {
        HTMLAttributes: {
          class: "underline underline-offset-4 decoration-border/60",
        },
      },
      strike: {
        HTMLAttributes: {
          class: "line-through opacity-50 decoration-foreground/40",
        },
      },
      link: {
        autolink: true,
        openOnClick: false,
        HTMLAttributes: {
          class:
            "font-normal underline underline-offset-4 decoration-border hover:decoration-foreground transition-all duration-300 cursor-pointer text-foreground",
          target: "_blank",
        },
      },
    }),
    HeadingExtension.configure({
      levels: [1, 2, 3, 4],
    }),
    BlockQuoteExtension,
    CodeBlockExtension,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    ImageExtension.configure({
      inline: false,
      HTMLAttributes: {
        class: "rounded-sm max-h-96 object-contain my-2 border border-border/20",
      },
    }),
    ImageUpload.configure({
      onUpload: handleImageUpload,
      onError: (error) => {
        toast.error(m.editor_image_upload_failed(), {
          description: error.message || m.editor_action_unknown_error(),
        });
      },
    }),
    FileHandler.configure({
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
      onDrop: handleFileDrop,
      onPaste: handleFilePaste,
    }),
    Placeholder.configure({
      placeholder: m.about_editor_placeholder(),
      emptyEditorClass: "is-editor-empty",
    }),
  ];
}

interface AboutEditorProps {
  initialContent?: JSONContent | null;
  isSubmitting?: boolean;
  onCancel?: () => void;
  onSubmit: (content: JSONContent) => Promise<boolean>;
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

export function AboutEditor({
  initialContent,
  isSubmitting,
  onCancel,
  onSubmit,
}: AboutEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: getAboutEditorExtensions(),
    content: initialContent ?? "",
    autofocus: "end",
    editorProps: {
      attributes: {
        class:
          "min-h-[320px] w-full bg-transparent py-3 text-sm leading-relaxed text-foreground focus:outline-none placeholder:text-muted-foreground/30 max-w-none",
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
    const url = window.prompt(
      m.comments_editor_modal_link_label(),
      previousUrl ?? "",
    );
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
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          icon={Heading1}
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          icon={Heading2}
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          icon={List}
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          icon={ListOrdered}
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
          icon={ListTodo}
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          icon={Quote}
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          icon={Terminal}
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
