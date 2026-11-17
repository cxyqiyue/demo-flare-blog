import { Play } from "lucide-react";
import { useState } from "react";
import { resolveMomentVideo } from "@/features/moments/video";

export function MomentVideo({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const video = resolveMomentVideo(url);
  if (!video) return null;
  return (
    <div className="aspect-video overflow-hidden rounded-xl bg-muted">
      {failed ? (
        <div
          role="status"
          className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm"
        >
          <p>视频暂时无法播放</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            打开原视频
          </a>
        </div>
      ) : !playing ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="flex h-full w-full flex-col items-center justify-center gap-3 text-sm text-foreground"
        >
          <Play size={32} />
          播放视频
        </button>
      ) : video.kind === "direct" ? (
        <video
          src={video.src}
          controls
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          className="h-full w-full"
          aria-label="动态视频"
        >
          <track kind="captions" />
        </video>
      ) : (
        <iframe
          src={video.src}
          title="动态视频"
          className="h-full w-full border-0"
          allow="fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  );
}
