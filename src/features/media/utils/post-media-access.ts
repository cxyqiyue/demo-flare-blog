/** URL identities shared by current-reference authorization and response rewriting. */
export interface ManagedMediaReference {
  provider: string;
  key: string;
  url: string;
}

export interface MediaIdentity {
  provider: string;
  key: string;
}

const RELATIVE_ORIGIN = "https://media.invalid";

function parseUrl(value: string): URL | null {
  try {
    const url = new URL(value, RELATIVE_ORIGIN);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function decodePath(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function ownHosts(ownOrigins: readonly string[]): Set<string> {
  const hosts = new Set([new URL(RELATIVE_ORIGIN).host]);
  for (const origin of ownOrigins) {
    const url = parseUrl(origin.includes("://") ? origin : "https://" + origin);
    if (url) hosts.add(url.host.toLowerCase());
  }
  return hosts;
}

/** Inputs here are already decoded once; never decode a stored object key again. */
export function normalizeMediaIdentity(
  provider: string,
  key: string,
): MediaIdentity | null {
  if (
    !key ||
    key.includes("\\") ||
    [...key].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    return null;
  if (provider === "r2-native") provider = "r2";
  if (provider === "telegram") {
    const handle = key.replace(/^telegram\//, "");
    const match = /^(\d+):([A-Za-z0-9_-]+)$/.exec(handle);
    // Telegram reads fileId only. A forged messageId must not escape the same ACL.
    if (!match) return null;
    return { provider, key: match[2] };
  }
  if (provider === "discord") {
    const match = /^(\d+)(?::(\d+))?$/.exec(key);
    if (!match) return null;
    const messageId = match[1].replace(/^0+(?=\d)/, "");
    const index = Number(match[2] ?? "0");
    if (!Number.isSafeInteger(index) || index < 0) return null;
    return { provider, key: index === 0 ? messageId : messageId + ":" + index };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(provider)) return null;
  if (
    provider !== "r2" &&
    key.split("/").some((part) => part === "." || part === "..")
  )
    return null;
  if (provider === "webdav") key = key.split("/").filter(Boolean).join("/");
  if (!key) return null;
  return { provider, key };
}

export function mediaIdentityKey(identity: MediaIdentity): string {
  return JSON.stringify([identity.provider, identity.key]);
}

/** Only our exact hosts count as /images or /media/file; external lookalikes do not. */
export function parseManagedMediaUrl(
  value: string,
  ownOrigins: readonly string[] = [],
): MediaIdentity | null {
  const url = parseUrl(value);
  if (!url || !ownHosts(ownOrigins).has(url.host.toLowerCase())) return null;
  const image = /^\/images\/(.+)$/.exec(url.pathname);
  if (image) {
    const key = decodePath(image[1]);
    return key === null ? null : normalizeMediaIdentity("r2", key);
  }
  const proxy = /^\/media\/file\/([^/]+)\/(.+)$/.exec(url.pathname);
  if (!proxy) return null;
  const provider = decodePath(proxy[1]);
  const key = decodePath(proxy[2]);
  return provider === null || key === null
    ? null
    : normalizeMediaIdentity(provider, key);
}

/** Preserve significant query values on third-party URLs; hashes never reach upstream. */
export function directMediaUrlKey(value: string): string | null {
  const url = parseUrl(value);
  if (!url) return null;
  const path = decodePath(url.pathname);
  return JSON.stringify([url.origin, path ?? url.pathname, url.search]);
}

export function controlledMediaUrl(
  media: Pick<ManagedMediaReference, "provider" | "key">,
): string {
  const encodeKey = (key: string) =>
    key.split("/").map(encodeURIComponent).join("/");
  if (media.provider === "r2" || media.provider === "r2-native")
    return "/images/" + encodeKey(media.key);
  const key =
    media.provider === "telegram"
      ? media.key.replace(/^telegram\//, "")
      : media.key;
  return (
    "/media/file/" + encodeURIComponent(media.provider) + "/" + encodeKey(key)
  );
}

/** Visit every string, including download links and embedded HTML/Markdown URLs. */
function mapStrings<T>(content: T, transform: (value: string) => string): T {
  if (typeof content === "string") return transform(content) as T;
  if (Array.isArray(content))
    return content.map((item) => mapStrings(item, transform)) as T;
  if (content !== null && typeof content === "object") {
    return Object.fromEntries(
      Object.entries(content).map(([key, value]) => [
        key,
        mapStrings(value, transform),
      ]),
    ) as T;
  }
  return content;
}

function decodeUrlEntities(value: string): string {
  return value.replace(
    /&#(?:x([a-f\d]+)|(\d+));?|&(amp|sol|colon|percnt|quot|apos|Tab|NewLine);/gi,
    (
      entity,
      hex: string | undefined,
      decimal: string | undefined,
      named: string | undefined,
    ) => {
      if (hex || decimal) {
        const code = Number.parseInt(hex ?? decimal ?? "", hex ? 16 : 10);
        return code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : entity;
      }
      return (
        (
          {
            amp: "&",
            sol: "/",
            colon: ":",
            percnt: "%",
            quot: '"',
            apos: "'",
            tab: "\t",
            newline: "\n",
          } as Record<string, string>
        )[named?.toLowerCase() ?? ""] ?? entity
      );
    },
  );
}

export function replaceMediaUrlReferences(
  value: string,
  replace: (url: string) => string,
): string {
  const apply = (url: string) => {
    const decoded = decodeUrlEntities(url);
    const next = replace(decoded);
    return next === decoded ? url : next;
  };
  const whole = apply(value);
  if (whole !== value) return whole;
  return value
    .replace(/(["'])([^"'<>]+)\1/g, (match, quote: string, url: string) => {
      const next = apply(url);
      return next === url ? match : quote + next + quote;
    })
    .replace(
      /\b(src|href|poster|data-src)(\s*=\s*)([^\s"'<>]+)/gi,
      (match, name: string, equals: string, url: string) => {
        const next = apply(url);
        return next === url ? match : name + equals + next;
      },
    )
    .replace(/\]\(([^\s)]+)\)/g, (match, url: string) => {
      const next = apply(url);
      return next === url ? match : "](" + next + ")";
    })
    .replace(
      /(?:https?:)?\/\/[^\s<>"']+|(?:\.{0,2}\/)?(?:images\/|media\/file\/)[^\s<>"']+/g,
      (token) => {
        const exact = apply(token);
        if (exact !== token) return exact;
        const trimmed = token.replace(/[),.;\]]+$/, "");
        return apply(trimmed) + token.slice(trimmed.length);
      },
    );
}

export function contentReferencesMedia(
  content: unknown,
  target: MediaIdentity,
  aliases: readonly ManagedMediaReference[],
  ownOrigins: readonly string[] = [],
): boolean {
  const targetKey = mediaIdentityKey(target);
  const directAliases = new Set(
    aliases
      .map((media) => directMediaUrlKey(media.url))
      .filter((key): key is string => key !== null),
  );
  let found = false;
  mapStrings(content, (value) =>
    replaceMediaUrlReferences(value, (url) => {
      const identity = parseManagedMediaUrl(url, ownOrigins);
      if (
        (identity && mediaIdentityKey(identity) === targetKey) ||
        directAliases.has(directMediaUrlKey(url) ?? "")
      )
        found = true;
      return url;
    }),
  );
  return found;
}

/** Pure, non-mutating rewrite. Only registered media and our native R2 paths change. */
export function rewriteManagedMediaUrls<T>(
  content: T,
  media: readonly ManagedMediaReference[],
  ownOrigins: readonly string[] = [],
): T {
  const byDirectUrl = new Map<string, string>();
  const byIdentity = new Map<string, string>();
  for (const item of media) {
    const directKey = directMediaUrlKey(item.url);
    if (directKey) byDirectUrl.set(directKey, controlledMediaUrl(item));
    const identity = normalizeMediaIdentity(item.provider, item.key);
    if (identity)
      byIdentity.set(mediaIdentityKey(identity), controlledMediaUrl(item));
  }
  return mapStrings(content, (value) =>
    replaceMediaUrlReferences(value, (url) => {
      const identity = parseManagedMediaUrl(url, ownOrigins);
      if (identity) {
        const managed = byIdentity.get(mediaIdentityKey(identity));
        if (managed) return managed;
        if (identity.provider === "r2") return controlledMediaUrl(identity);
      }
      return byDirectUrl.get(directMediaUrlKey(url) ?? "") ?? url;
    }),
  );
}

export function collectManagedMediaReferences(
  content: unknown,
  media: readonly ManagedMediaReference[],
  ownOrigins: readonly string[] = [],
): Map<string, MediaIdentity> {
  const byUrl = new Map<string, MediaIdentity>();
  for (const item of media) {
    const identity = normalizeMediaIdentity(item.provider, item.key);
    const key = directMediaUrlKey(item.url);
    if (identity && key) byUrl.set(key, identity);
  }
  const result = new Map<string, MediaIdentity>();
  mapStrings(content, (value) =>
    replaceMediaUrlReferences(value, (url) => {
      const identity =
        parseManagedMediaUrl(url, ownOrigins) ??
        byUrl.get(directMediaUrlKey(url) ?? "");
      if (identity) result.set(mediaIdentityKey(identity), identity);
      return url;
    }),
  );
  return result;
}
