import { Blockquote } from "@tiptap/extension-blockquote";
import { mergeAttributes } from "@tiptap/react";

export const BlockQuoteExtension = Blockquote.extend({
  renderHTML({ HTMLAttributes }) {
    return [
      "blockquote",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class:
          "my-6 pl-4 border-l-2 border-muted-foreground/30 italic text-muted-foreground font-serif text-lg leading-relaxed tracking-tight",
      }),
      // Content renders here (0 = content placeholder, must be only child)
      0,
    ];
  },
});
