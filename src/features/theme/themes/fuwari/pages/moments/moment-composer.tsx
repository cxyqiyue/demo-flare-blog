import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { m } from "@/paraglide/messages";

interface MomentComposerProps {
  onCreate: (content: string, images: string[]) => Promise<boolean>;
}

export function MomentComposer({ onCreate }: MomentComposerProps) {
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateImage = (index: number, value: string) => {
    setImages((prev) => prev.map((img, i) => (i === index ? value : img)));
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    const cleanedImages = images.map((img) => img.trim()).filter(Boolean);
    if (!trimmed && cleanedImages.length === 0) {
      toast.error(m.moments_composer_content_required());
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await onCreate(trimmed, cleanedImages);
      if (ok) {
        setContent("");
        setImages([]);
      }
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

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={m.moments_composer_placeholder()}
        className="min-h-28 w-full rounded-xl border border-border/30 bg-muted/10 px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
      />

      <div className="space-y-3 mt-4">
        {images.map((img, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={img}
              onChange={(e) => updateImage(index, e.target.value)}
              placeholder={m.moments_composer_image_placeholder()}
              className="flex-1 rounded-xl border border-border/30 bg-muted/10 px-4 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeImage(index)}
              className="h-8 w-8 shrink-0 rounded-xl fuwari-text-40 hover:text-red-500"
            >
              <X size={14} />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 mt-5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setImages((prev) => [...prev, ""])}
          disabled={images.length >= 9}
          className="rounded-xl border-border/40 px-4 text-[10px] font-bold uppercase tracking-widest fuwari-text-40 hover:fuwari-text-90"
        >
          <ImagePlus size={12} className="mr-2" />
          {m.moments_composer_add_image()}
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="rounded-xl px-5 text-[10px] font-bold uppercase tracking-widest fuwari-btn-primary"
        >
          {isSubmitting ? (
            <Loader2 size={12} className="mr-2 animate-spin" />
          ) : (
            <Send size={12} className="mr-2" />
          )}
          {isSubmitting
            ? m.moments_composer_publishing()
            : m.moments_composer_submit()}
        </Button>
      </div>
    </div>
  );
}
