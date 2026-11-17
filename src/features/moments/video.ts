/** Only known embed hosts or HTTP video files are accepted; no arbitrary iframe URL. */
export function resolveMomentVideo(
  value: string,
): { kind: "embed" | "direct"; src: string } | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
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
        ? { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}` }
        : null;
    }
    if (host === "bilibili.com" || host === "www.bilibili.com") {
      const id = url.pathname.match(/\/video\/(BV[\w]+|av\d+)/)?.[1];
      if (!id) return null;
      return {
        kind: "embed",
        src: `https://player.bilibili.com/player.html?${id.startsWith("BV") ? "bvid=" + id : "aid=" + id.slice(2)}&autoplay=0`,
      };
    }
    return /\.(mp4|webm|ogg|mov)$/i.test(url.pathname)
      ? { kind: "direct", src: url.href }
      : null;
  } catch {
    return null;
  }
}
