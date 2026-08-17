import type { JSONContent } from "@tiptap/react";
import { useState } from "react";
import { MomentEditor } from "@/features/moments/components/moment-editor";
import { collectImageUrls } from "@/features/moments/components/moment-editor-config";
import { m } from "@/paraglide/messages";

interface MomentComposerProps {
  onCreate: (content: JSONContent, images: string[]) => Promise<boolean>;
}

export function MomentComposer({ onCreate }: MomentComposerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (content: JSONContent): Promise<boolean> => {
    if (isSubmitting) return false;
    const images = collectImageUrls(content);
    if (content.content?.length === 0 && images.length === 0) {
      return false;
    }

    setIsSubmitting(true);
    try {
      return await onCreate(content, images);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mb-12 border border-border/30 bg-muted/5 p-6 space-y-5">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-foreground/40" />
        <h3 className="text-sm font-serif font-medium text-foreground">
          {m.moments_composer_title()}
        </h3>
      </div>

      <MomentEditor onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}
