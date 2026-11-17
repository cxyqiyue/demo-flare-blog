import type { JSONContent } from "@tiptap/react";
import { lazy, Suspense, useState } from "react";
import { collectImageUrls } from "@/features/moments/components/moment-editor-config";
import { MomentVideoUrlSchema } from "@/features/moments/moments.schema";
import { m } from "@/paraglide/messages";

// TipTap 编辑器体积大，且仅在管理员展开发布框时挂载，按需加载
const MomentEditor = lazy(() =>
  import("@/features/moments/components/moment-editor").then((mod) => ({
    default: mod.MomentEditor,
  })),
);

interface MomentComposerProps {
  onCreate: (
    content: JSONContent,
    images: string[],
    videoUrl?: string | null,
  ) => Promise<boolean>;
}

export function MomentComposer({ onCreate }: MomentComposerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState(false);

  const handleSubmit = async (content: JSONContent): Promise<boolean> => {
    if (isSubmitting) return false;
    const parsed = MomentVideoUrlSchema.safeParse(videoUrl.trim() || null);
    setVideoError(!parsed.success);
    if (!parsed.success) return false;
    const images = collectImageUrls(content);
    if (content.content?.length === 0 && images.length === 0 && !parsed.data) {
      return false;
    }

    setIsSubmitting(true);
    try {
      const ok = await onCreate(content, images, parsed.data);
      if (ok) setVideoUrl("");
      return ok;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flare-surface-soft p-5 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-foreground/40" />
        <h3 className="text-sm font-semibold text-foreground">
          {m.moments_composer_title()}
        </h3>
      </div>

      <Suspense fallback={null}>
        <MomentEditor
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          allowEmpty={Boolean(videoUrl.trim())}
        />
      </Suspense>
      <label className="flex flex-col gap-2 text-sm">
        视频链接
        <input
          type="url"
          value={videoUrl}
          onChange={(event) => setVideoUrl(event.target.value)}
          placeholder="Bilibili / YouTube / MP4、WebM 视频地址"
          className="w-full rounded-xl border border-border bg-background px-3 py-2"
          aria-invalid={videoError}
        />
      </label>
      {videoError ? (
        <p role="alert" className="text-sm text-destructive">
          请输入有效的 Bilibili、YouTube 或视频文件链接。
        </p>
      ) : null}
    </div>
  );
}
