import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  Sigma,
  SquareFunction,
  Strikethrough,
  Table as TableIcon,
  Terminal,
  Underline as UnderlineIcon,
  Undo,
} from "lucide-react";
import type React from "react";
import { m } from "@/paraglide/messages";

interface EditorToolbarProps {
  editor: Editor | null;
  onLinkClick: () => void;
  onImageClick: () => void;
  onFormulaInlineClick: () => void;
  onFormulaBlockClick: () => void;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  icon: LucideIcon;
  label?: string;
  variant?: "default" | "ghost";
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  isActive,
  icon: Icon,
  label,
}) => (
  <button
    onClick={onClick}
    className={clsx(
      "h-8 w-8 shrink-0 flex items-center justify-center transition-colors duration-200 group relative rounded-none",
      isActive
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:text-foreground hover:bg-muted/20",
    )}
    title={label}
    type="button"
  >
    <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
  </button>
);

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  onLinkClick,
  onImageClick,
  onFormulaInlineClick,
  onFormulaBlockClick,
}) => {
  const {
    isBold,
    isHeading1,
    isHeading2,
    isHeading3,
    isHeading4,
    isItalic,
    isUnderline,
    isStrike,
    isCode,
    isCodeBlock,
    isInlineMath,
    isBlockMath,
    isBulletList,
    isOrderedList,
    isTaskList,
    isBlockquote,
    isLink,
  } = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return {
          isBold: false,
          isHeading1: false,
          isHeading2: false,
          isHeading3: false,
          isHeading4: false,
          isItalic: false,
          isUnderline: false,
          isStrike: false,
          isCode: false,
          isBulletList: false,
          isOrderedList: false,
          isTaskList: false,
          isBlockquote: false,
          isLink: false,
          isInlineMath: false,
          isBlockMath: false,
        };
      }
      return {
        isBold: ctx.editor.isActive("bold"),
        isHeading1: ctx.editor.isActive("heading", { level: 1 }),
        isHeading2: ctx.editor.isActive("heading", { level: 2 }),
        isHeading3: ctx.editor.isActive("heading", { level: 3 }),
        isHeading4: ctx.editor.isActive("heading", { level: 4 }),
        isItalic: ctx.editor.isActive("italic"),
        isUnderline: ctx.editor.isActive("underline"),
        isStrike: ctx.editor.isActive("strike"),
        isCode: ctx.editor.isActive("code"),
        isCodeBlock: ctx.editor.isActive("codeBlock"),
        isInlineMath: ctx.editor.isActive("inlineMath"),
        isBlockMath: ctx.editor.isActive("blockMath"),
        isBulletList: ctx.editor.isActive("bulletList"),
        isOrderedList: ctx.editor.isActive("orderedList"),
        isTaskList: ctx.editor.isActive("taskList"),
        isBlockquote: ctx.editor.isActive("blockquote"),
        isLink: ctx.editor.isActive("link"),
      };
    },
  }) || {
    isBold: false,
    isHeading1: false,
    isHeading2: false,
    isHeading3: false,
    isHeading4: false,
    isItalic: false,
    isUnderline: false,
    isStrike: false,
    isCode: false,
    isCodeBlock: false,
    isInlineMath: false,
    isBlockMath: false,
    isBulletList: false,
    isOrderedList: false,
    isTaskList: false,
    isBlockquote: false,
    isLink: false,
  };

  return (
    <div className="sticky top-0 z-30 mb-8 py-2 bg-background border-b border-border/50 flex items-center gap-1 px-4 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
      {/* Headings */}
      <ToolbarButton
        onClick={() =>
          editor?.chain().focus().toggleHeading({ level: 1 }).run()
        }
        isActive={isHeading1}
        icon={Heading1}
        label={m.editor_toolbar_heading1()}
      />
      <ToolbarButton
        onClick={() =>
          editor?.chain().focus().toggleHeading({ level: 2 }).run()
        }
        isActive={isHeading2}
        icon={Heading2}
        label={m.editor_toolbar_heading2()}
      />
      <ToolbarButton
        onClick={() =>
          editor?.chain().focus().toggleHeading({ level: 3 }).run()
        }
        isActive={isHeading3}
        icon={Heading3}
        label={m.editor_toolbar_heading3()}
      />
      <ToolbarButton
        onClick={() =>
          editor?.chain().focus().toggleHeading({ level: 4 }).run()
        }
        isActive={isHeading4}
        icon={Heading4}
        label={m.editor_toolbar_heading4()}
      />

      <div className="h-4 w-px shrink-0 bg-border/50 mx-2"></div>

      {/* Formatting */}
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleBold().run()}
        isActive={isBold}
        icon={Bold}
        label={m.editor_toolbar_bold()}
      />
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleItalic().run()}
        isActive={isItalic}
        icon={Italic}
        label={m.editor_toolbar_italic()}
      />
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
        isActive={isUnderline}
        icon={UnderlineIcon}
        label={m.editor_toolbar_underline()}
      />
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleStrike().run()}
        isActive={isStrike}
        icon={Strikethrough}
        label={m.editor_toolbar_strike()}
      />
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleCode().run()}
        isActive={isCode}
        icon={Code}
        label={m.editor_toolbar_code()}
      />
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        isActive={isCodeBlock}
        icon={Terminal}
        label={m.editor_toolbar_code_block()}
      />
      <ToolbarButton
        onClick={onFormulaInlineClick}
        isActive={isInlineMath}
        icon={Sigma}
        label={m.editor_toolbar_formula_inline()}
      />
      <ToolbarButton
        onClick={onFormulaBlockClick}
        isActive={isBlockMath}
        icon={SquareFunction}
        label={m.editor_toolbar_formula_block()}
      />

      <div className="h-4 w-px shrink-0 bg-border/50 mx-2"></div>

      {/* Lists & Blocks */}
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
        isActive={isBulletList}
        icon={List}
        label={m.editor_toolbar_bullet_list()}
      />
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        isActive={isOrderedList}
        icon={ListOrdered}
        label={m.editor_toolbar_ordered_list()}
      />
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleTaskList().run()}
        isActive={isTaskList}
        icon={ListChecks}
        label={m.editor_toolbar_task_list()}
      />
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        isActive={isBlockquote}
        icon={Quote}
        label={m.editor_toolbar_blockquote()}
      />
      <ToolbarButton
        onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        isActive={false}
        icon={Minus}
        label={m.editor_toolbar_horizontal_rule()}
      />
      <ToolbarButton
        onClick={() =>
          editor
            ?.chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        isActive={editor?.isActive("table")}
        icon={TableIcon}
        label={m.editor_toolbar_table()}
      />

      <div className="h-4 w-px shrink-0 bg-border/50 mx-2"></div>

      {/* Inserts */}
      <ToolbarButton
        onClick={onLinkClick}
        isActive={isLink}
        icon={LinkIcon}
        label={m.editor_toolbar_link()}
      />
      <ToolbarButton
        onClick={onImageClick}
        isActive={false}
        icon={ImageIcon}
        label={m.editor_toolbar_image()}
      />

      <div className="ml-auto flex gap-1 shrink-0">
        <ToolbarButton
          onClick={() => editor?.chain().focus().undo().run()}
          icon={Undo}
          label={m.editor_toolbar_undo()}
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().redo().run()}
          icon={Redo}
          label={m.editor_toolbar_redo()}
        />
      </div>
    </div>
  );
};

export default EditorToolbar;
