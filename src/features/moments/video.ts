/** Only known embed hosts or HTTP video files are accepted; no arbitrary iframe URL. */
export function resolveMomentVideo(
  value: string,
):
  | { kind: "embed" | "direct"; src: string; pageUrl: string }
  | { kind: "hosted"; src: string; pageUrl: string; poster: string }
  | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    const hostedVideoId = url.pathname.match(
      /^\/(?:w|watch)\/([\da-f]{32})$/i,
    )?.[1];
    if (host === "video.dukda.com" && hostedVideoId) {
      const id = hostedVideoId.toLowerCase();
      return {
        kind: "hosted",
        src: `https://video.dukda.com/_content/derived/${id}/${id}-720p.mp4`,
        pageUrl: `https://video.dukda.com/w/${id}`,
        poster: `https://video.dukda.com/_content/derived/${id}/poster.jpg`,
      };
    }
    if (
      ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(
        host,
      )
    ) {
      const id =
        host === "youtu.be"
          ? url.pathname.slice(1)
          : url.searchParams.get("v") ||
            url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1];
      return id && /^[\w-]{11}$/.test(id)
        ? {
            kind: "embed",
            src: `https://www.youtube-nocookie.com/embed/${id}`,
            pageUrl: url.href,
          }
        : null;
    }
    if (host === "bilibili.com" || host === "www.bilibili.com") {
      const id = url.pathname.match(/\/video\/(BV[\w]+|av\d+)/)?.[1];
      if (!id) return null;
      return {
        kind: "embed",
        src: `https://player.bilibili.com/player.html?${id.startsWith("BV") ? "bvid=" + id : "aid=" + id.slice(2)}&autoplay=0`,
        pageUrl: url.href,
      };
    }
    return /\.(mp4|webm|ogg|mov)$/i.test(url.pathname)
      ? { kind: "direct", src: url.href, pageUrl: url.href }
      : null;
  } catch {
    return null;
  }
}
