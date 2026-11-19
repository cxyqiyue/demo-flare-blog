import { ArrowUpRight, Play } from "lucide-react";
import { useState } from "react";
import { resolveMomentVideo } from "@/features/moments/video";
import { m } from "@/paraglide/messages";

export function MomentVideo({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const video = resolveMomentVideo(url);
  if (!video) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
      <div
        className="relative aspect-video overflow-hidden bg-muted"
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
              href={video.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              {m.moments_video_open_original()}
            </a>
          </div>
        ) : playing && video.kind !== "embed" ? (
          <video
            src={video.src}
            controls
            playsInline
            autoPlay
            preload="metadata"
            poster={video.kind === "hosted" ? video.poster : undefined}
            onError={() => setFailed(true)}
            className="h-full w-full object-contain"
            aria-label={m.moments_video_aria_label()}
          >
            <track kind="captions" />
          </video>
        ) : playing ? (
          <iframe
            src={video.src}
            title={m.moments_video_aria_label()}
            className="h-full w-full border-0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group relative flex h-full w-full items-center justify-center text-sm text-foreground"
            aria-label={m.moments_video_play()}
          >
            {video.kind === "hosted" ? (
              <img
                src={video.poster}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
              />
            ) : null}
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-black/70 text-white shadow-lg transition-transform group-hover:scale-105">
              <Play size={24} fill="currentColor" />
            </span>
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
        <span className="truncate text-muted-foreground">
          {new URL(video.pageUrl).hostname}
        </span>
        <a
          href={video.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground hover:text-primary"
        >
          {m.moments_video_open_page()}
          <ArrowUpRight size={13} />
        </a>
      </div>
    </div>
  );
}
