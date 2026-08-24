import type {
  Extensions,
  JSONContent,
  Editor as TiptapEditor,
} from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import { lazy, memo, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { uploadEditorImage } from "@/features/image-hosting/utils/upload-editor-image";
import { handleServerError } from "@/lib/errors/error-handler";
import { parseRequestError } from "@/lib/errors/request-errors";
import { normalizeLinkHref } from "@/lib/links/normalize-link-href";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { FormulaModalPayload } from "./formula-modal-store";
import {
  addFormulaModalOpener,
  removeFormulaModalOpener,
  setActiveFormulaModalOpenerKey,
} from "./formula-modal-store";
import EditorToolbar from "./ui/editor-toolbar";
import type { FormulaMode } from "./ui/formula-modal";
import type { ModalType } from "./ui/insert-modal";
import InsertModal from "./ui/insert-modal";
import { TableBubbleMenu } from "./ui/table-bubble-menu";

// 公式弹窗依赖 katex（体积大），仅在打开时加载
const FormulaModal = lazy(() =>
  import("./ui/formula-modal").then((mod) => ({
    default: mod.FormulaModal,
  })),
);

interface EditorProps {
  content?: JSONContent | string;
  onChange?: (json: JSONContent) => void;
  onCreated?: (editor: TiptapEditor) => void;
  extensions: Extensions;
  editable?: boolean;
  className?: string;
  contentClassName?: string;
}

export const Editor = memo(function Editor({
  content,
  onChange,
  onCreated,
  extensions,
  editable = true,
  className,
  contentClassName,
}: EditorProps) {
  const formulaOpenerKeyRef = useRef(Symbol("formula-modal-opener"));
  const [modalOpen, setModalOpen] = useState<ModalType>(null);
  const [modalInitialUrl, setModalInitialUrl] = useState("");
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);
  const [formulaPayload, setFormulaPayload] = useState<{
    mode: FormulaMode;
    initialLatex: string;
    editContext: { pos: number; type: FormulaMode } | null;
  }>({ mode: "inline", initialLatex: "", editContext: null });

  const editor = useEditor({
    extensions,
    content,
    editable,
    onCreate: ({ editor: currentEditor }) => {
      onCreated?.(currentEditor);
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange?.(currentEditor.getJSON());
    },
    editorProps: {
      attributes: {
        class: cn(
          "max-w-none focus:outline-none text-lg leading-relaxed min-h-[500px]",
          !editable && "min-h-0 text-base leading-7",
          contentClassName,
        ),
      },
    },
    immediatelyRender: false,
  });

  const openLinkModal = useCallback(() => {
    const previousUrl = editor?.getAttributes("link").href;
    setModalInitialUrl(previousUrl || "");
    setModalOpen("LINK");
  }, [editor]);

  const openImageModal = useCallback(() => {
    setModalInitialUrl("");
    setModalOpen("IMAGE");
  }, []);

  const openFormulaModal = useCallback((mode: FormulaMode) => {
    setFormulaPayload({
      mode,
      initialLatex: mode === "inline" ? "x^2+y^2=z^2" : "E = mc^2",
      editContext: null,
    });
    setFormulaModalOpen(true);
  }, []);

  useEffect(() => {
    if (!editable) return;

    const opener = (payload: FormulaModalPayload) => {
      setFormulaPayload({
        mode: payload.type,
        initialLatex: payload.latex,
        editContext: { pos: payload.pos, type: payload.type },
      });
      setFormulaModalOpen(true);
    };
    addFormulaModalOpener(formulaOpenerKeyRef.current, opener);
    return () => removeFormulaModalOpener(formulaOpenerKeyRef.current);
  }, [editable]);

  const markActiveFormulaOpener = useCallback(() => {
    if (!editable) return;
    setActiveFormulaModalOpenerKey(formulaOpenerKeyRef.current);
  }, [editable]);

  const handleFormulaApply = useCallback(
    (
      latex: string,
      mode: FormulaMode,
      editContext: { pos: number; type: FormulaMode } | null,
    ) => {
      if (!editor) return;
      if (editContext && editContext.type !== mode) {
        const chain = editor
          .chain()
          .setNodeSelection(editContext.pos)
          .deleteSelection();
        if (mode === "inline") {
          chain.insertInlineMath({ latex }).focus().run();
        } else {
          chain.insertBlockMath({ latex }).focus().run();
        }
      } else if (editContext) {
        if (editContext.type === "inline") {
          editor
            .chain()
            .setNodeSelection(editContext.pos)
            .updateInlineMath({ latex })
            .focus()
            .run();
        } else {
          editor
            .chain()
            .setNodeSelection(editContext.pos)
            .updateBlockMath({ latex })
            .focus()
            .run();
        }
      } else {
        if (mode === "inline") {
          editor.chain().focus().insertInlineMath({ latex }).run();
        } else {
          editor.chain().focus().insertBlockMath({ latex }).run();
        }
      }
      setFormulaModalOpen(false);
    },
    [editor],
  );

  const handleModalSubmit = (
    url: string,
    attrs?: { width?: number; height?: number },
  ) => {
    if (modalOpen === "LINK") {
      if (url === "") {
        editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      } else {
        const href = normalizeLinkHref(url);
        editor?.chain().focus().extendMarkRange("link").setLink({ href }).run();
      }
    } else if (modalOpen === "IMAGE") {
      if (url) {
        editor
          ?.chain()
          .focus()
          .setImage({ src: url, ...attrs })
          .run();
      }
    }

    setModalOpen(null);
  };

  const handleFilesUploaded = useCallback(
    (results: Array<{ url: string; width?: number; height?: number }>) => {
      for (const item of results) {
        editor?.chain().focus().setImage({ src: item.url, ...item }).run();
      }
      setModalOpen(null);
    },
    [editor],
  );

  const handleFileUpload = useCallback(
    async (
      file: File,
      onProgress?: (fraction: number) => void,
    ): Promise<string | null> => {
      try {
        const result = await uploadEditorImage(file, { onProgress });
        return result.url;
      } catch (error) {
        const parsed = parseRequestError(error);
        if (parsed.code === "UNKNOWN") {
          toast.error(m.editor_image_upload_failed(), {
            description: parsed.message,
          });
        } else {
          handleServerError(error);
        }
        return null;
      }
    },
    [],
  );

  return (
    <div className={cn("relative flex flex-col group", className)}>
      {editable && (
        <EditorToolbar
          editor={editor}
          onLinkClick={openLinkModal}
          onImageClick={openImageModal}
          onFormulaInlineClick={() => openFormulaModal("inline")}
          onFormulaBlockClick={() => openFormulaModal("block")}
        />
      )}

      {editable && <TableBubbleMenu editor={editor} />}

      <div
        className="relative min-h-125"
        onMouseDownCapture={markActiveFormulaOpener}
        onFocusCapture={markActiveFormulaOpener}
      >
        <EditorContent editor={editor} />
      </div>

      {editable && (
        <InsertModal
          type={modalOpen}
          initialUrl={modalInitialUrl}
          onClose={() => setModalOpen(null)}
          onSubmit={handleModalSubmit}
          onFileUpload={handleFileUpload}
          onFilesUploaded={handleFilesUploaded}
        />
      )}

      {editable && (
        <Suspense fallback={null}>
          <FormulaModal
            isOpen={formulaModalOpen}
            mode={formulaPayload.mode}
            initialLatex={formulaPayload.initialLatex}
            editContext={formulaPayload.editContext}
            onClose={() => setFormulaModalOpen(false)}
            onApply={handleFormulaApply}
          />
        </Suspense>
      )}
    </div>
  );
});
