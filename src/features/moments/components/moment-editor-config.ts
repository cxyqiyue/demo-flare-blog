import FileHandler from "@tiptap/extension-file-handler";
import Placeholder from "@tiptap/extension-placeholder";
import type { Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { toast } from "sonner";
import { uploadEditorImage } from "@/features/image-hosting/utils/upload-editor-image";
import { ImageExtension } from "@/features/posts/editor/extensions/images";
import type { ImageUploadResult } from "@/features/posts/editor/extensions/upload-image";
import { ImageUpload } from "@/features/posts/editor/extensions/upload-image";
import { m } from "@/paraglide/messages";

const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];

async function handleImageUpload(file: File): Promise<ImageUploadResult> {
  return await uploadEditorImage(file);
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

export function getMomentExtensions() {
  return [
    StarterKit.configure({
      orderedList: false,
      bulletList: false,
      listItem: false,
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
    ImageExtension.configure({
      inline: false,
      HTMLAttributes: {
        class:
          "rounded-sm max-h-96 object-contain my-2 border border-border/20",
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
      placeholder: m.moments_composer_placeholder(),
      emptyEditorClass: "is-editor-empty",
    }),
  ];
}

export function collectImageUrls(json: unknown): string[] {
  const urls: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as {
      type?: string;
      attrs?: { src?: string };
      content?: Array<unknown>;
    };
    if (
      n.type === "image" &&
      n.attrs?.src &&
      !n.attrs.src.startsWith("blob:")
    ) {
      urls.push(n.attrs.src);
    }
    (n.content ?? []).forEach(walk);
  };
  walk(json);
  return urls;
}
