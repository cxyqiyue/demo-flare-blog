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
    <div className="fuwari-card-base p-6 md:p-8 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="h-2 w-2 rounded-full bg-(--fuwari-primary)" />
        <h3 className="text-sm font-bold fuwari-text-90 transition-colors">
          {m.moments_composer_title()}
        </h3>
      </div>

      <MomentEditor
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
