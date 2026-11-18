import { Play } from "lucide-react";
import { useState } from "react";
import { resolveMomentVideo } from "@/features/moments/video";
import { m } from "@/paraglide/messages";

export function MomentVideo({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const video = resolveMomentVideo(url);
  if (!video) return null;
  return (
    <div
      className="aspect-video overflow-hidden rounded-xl bg-muted"
      role="region"
      aria-label={m.moments_video_aria_label()}
    >
      {failed ? (
        <div
          role="status"
          className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm"
        >
          <p>{m.moments_video_unavailable()}</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            {m.moments_video_open_original()}
          </a>
        </div>
      ) : !playing ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="flex h-full w-full flex-col items-center justify-center gap-3 text-sm text-foreground"
        >
          <Play size={32} />
          {m.moments_video_play()}
        </button>
      ) : video.kind === "direct" ? (
        <video
          src={video.src}
          controls
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          className="h-full w-full"
          aria-label={m.moments_video_aria_label()}
        >
          <track kind="captions" />
        </video>
      ) : (
        <iframe
          src={video.src}
          title={m.moments_video_aria_label()}
          className="h-full w-full border-0"
          allow="fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  );
}
