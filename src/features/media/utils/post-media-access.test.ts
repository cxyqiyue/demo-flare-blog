import { describe, expect, it } from "vitest";
import {
  collectManagedMediaReferences,
  contentReferencesMedia,
  controlledMediaUrl,
  normalizeMediaIdentity,
  parseManagedMediaUrl,
  rewriteManagedMediaUrls,
} from "./post-media-access";

const origins = ["https://blog.example.com", "https://cdn.example.com"];
const target = { provider: "r2", key: "post/secret image.webp" };
const media = [
  { ...target, url: "https://cdn.example.com/images/post/secret%20image.webp" },
  {
    provider: "imgbb",
    key: "remote-1",
    url: "https://i.example.net/a.jpg?token=a&v=2",
  },
  {
    provider: "telegram",
    key: "telegram/123:file_one",
    url: "/media/file/telegram/123%3Afile_one",
  },
];

describe("current Post media URL identities", () => {
  it.each([
    "/images/post/secret%20image.webp",
    "images/post/secret%20image.webp?orig=1",
    "https://blog.example.com/images/post%2Fsecret%20image.webp?width=400#preview",
    "//cdn.example.com/images/post/secret%20image.webp",
    "/media/file/r2/post/secret%20image.webp",
    "/media/file/r2-native/post%2Fsecret%20image.webp?orig=1",
  ])("matches relative/absolute/query/encoded R2 identity: %s", (url) => {
    expect(parseManagedMediaUrl(url, origins)).toEqual(target);
    expect(
      contentReferencesMedia({ attrs: { src: url } }, target, media, origins),
    ).toBe(true);
  });

  it("does not let an external path lookalike associate an unrelated object", () => {
    expect(
      parseManagedMediaUrl(
        "https://evil.example/images/post/secret%20image.webp",
        origins,
      ),
    ).toBeNull();
    expect(
      contentReferencesMedia(
        { src: "https://evil.example/images/post/secret%20image.webp" },
        target,
        media,
        origins,
      ),
    ).toBe(false);
  });

  it("finds entity-encoded HTML/Markdown URLs without changing unrelated text", () => {
    const url = "/images/post/secret%20image.webp";
    const encoded = "&#47;images&#47;post&#47;secret%20image.webp";
    expect(
      contentReferencesMedia(
        { html: '<img src="' + encoded + '">' },
        target,
        media,
        origins,
      ),
    ).toBe(true);
    expect(
      contentReferencesMedia(
        { html: "<img src=" + encoded + ">" },
        target,
        media,
        origins,
      ),
    ).toBe(true);
    expect(
      contentReferencesMedia(
        { text: "![x](" + encoded + ")" },
        target,
        media,
        origins,
      ),
    ).toBe(true);
    expect(
      rewriteManagedMediaUrls(
        { text: "ordinary &amp; text", src: url },
        media,
        origins,
      ).text,
    ).toBe("ordinary &amp; text");
  });

  it("decodes paths once and rejects malformed encoding", () => {
    expect(parseManagedMediaUrl("/images/a%252Fb.jpg")).toEqual({
      provider: "r2",
      key: "a%2Fb.jpg",
    });
    expect(parseManagedMediaUrl("/images/%ZZ")).toBeNull();
  });

  it("matches the actual Telegram fileId despite a forged messageId", () => {
    expect(parseManagedMediaUrl("/media/file/telegram/999%3Afile_one")).toEqual(
      { provider: "telegram", key: "file_one" },
    );
    expect(
      contentReferencesMedia(
        { src: media[2].url },
        { provider: "telegram", key: "file_one" },
        [],
        origins,
      ),
    ).toBe(true);
  });

  it("unifies Discord default/index zero and validates indices", () => {
    expect(normalizeMediaIdentity("discord", "00123:00")).toEqual({
      provider: "discord",
      key: "123",
    });
    expect(normalizeMediaIdentity("discord", "123:-1")).toBeNull();
    expect(
      normalizeMediaIdentity("discord", "123:9007199254740992"),
    ).toBeNull();
  });

  it("blocks upstream path traversal and canonicalizes WebDAV slashes", () => {
    expect(
      parseManagedMediaUrl("/media/file/webdav/a%2F..%2Fsecret.jpg"),
    ).toBeNull();
    expect(normalizeMediaIdentity("webdav", "/a//secret.jpg")).toEqual({
      provider: "webdav",
      key: "a/secret.jpg",
    });
    expect(normalizeMediaIdentity("s3", "a\\secret.jpg")).toBeNull();
  });

  it("finds registered third-party URLs, nested JSON, HTML and Markdown", () => {
    const remote = { provider: "imgbb", key: "remote-1" };
    for (const value of [
      { nested: [{ attrs: { href: media[1].url } }] },
      { html: '<img src="' + media[1].url + '">' },
      { text: "![image](" + media[1].url + ")" },
    ])
      expect(contentReferencesMedia(value, remote, [media[1]], origins)).toBe(
        true,
      );
    expect(
      contentReferencesMedia(
        { src: "https://i.example.net/a.jpg?token=wrong&v=2" },
        remote,
        [media[1]],
        origins,
      ),
    ).toBe(false);
  });
});

describe("controlled Post media response rewriting", () => {
  it("returns a new tree and rewrites recognized direct URLs to authenticated paths", () => {
    const input = {
      content: [
        {
          attrs: {
            src: media[1].url,
            href: "https://unmanaged.example/image.jpg",
          },
        },
        { html: '<img src="' + media[1].url + '">' },
        {
          attrs: {
            src: "https://blog.example.com/images/post/secret%20image.webp?width=999",
          },
        },
      ],
    };
    const output = rewriteManagedMediaUrls(input, media, origins);
    expect(input.content[0].attrs?.src).toBe(media[1].url);
    expect(output.content[0].attrs).toEqual({
      src: "/media/file/imgbb/remote-1",
      href: "https://unmanaged.example/image.jpg",
    });
    expect(output.content[1].html).toBe(
      '<img src="/media/file/imgbb/remote-1">',
    );
    expect(output.content[2].attrs?.src).toBe(
      "/images/post/secret%20image.webp",
    );
  });

  it("preserves literal percent sequences instead of double decoding keys", () => {
    expect(
      controlledMediaUrl({ provider: "r2", key: "literal%2Fname.jpg" }),
    ).toBe("/images/literal%252Fname.jpg");
    expect(controlledMediaUrl(media[2])).toBe(
      "/media/file/telegram/123%3Afile_one",
    );
  });

  it("collects managed references for cross-author attach protection", () => {
    const refs = collectManagedMediaReferences(
      { src: media[1].url, body: "![x](/images/post/secret%20image.webp)" },
      media,
      origins,
    );
    expect([...refs.values()]).toEqual(
      expect.arrayContaining([target, { provider: "imgbb", key: "remote-1" }]),
    );
  });
});
