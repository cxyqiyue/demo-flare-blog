import { describe, expect, it } from "vitest";
import { resolveValidatedS3Config, s3ObjectBodyToResponse } from "./s3-upload";

const base = {
  endpoint: "https://s3.example.com/",
  bucket: "blog",
  accessKeyId: "ak",
  secretAccessKey: "sk",
};

describe("resolveValidatedS3Config", () => {
  it("returns null when required fields are missing", () => {
    expect(resolveValidatedS3Config(undefined)).toBeNull();
    expect(resolveValidatedS3Config(null)).toBeNull();
    expect(resolveValidatedS3Config({ ...base, bucket: " " })).toBeNull();
    expect(resolveValidatedS3Config({ ...base, endpoint: "" })).toBeNull();
    expect(resolveValidatedS3Config({ ...base, accessKeyId: null })).toBeNull();
    expect(
      resolveValidatedS3Config({ ...base, secretAccessKey: " " }),
    ).toBeNull();
  });

  it("normalizes trailing slashes and trims optional fields", () => {
    const cfg = resolveValidatedS3Config({
      ...base,
      pathPrefix: "/images/blog/",
      publicUrl: " https://cdn.example.com ",
      pathStyle: true,
    });
    expect(cfg).toEqual({
      endpoint: "https://s3.example.com",
      bucket: "blog",
      region: "",
      accessKeyId: "ak",
      secretAccessKey: "sk",
      pathPrefix: "/images/blog/",
      publicUrl: "https://cdn.example.com",
      pathStyle: true,
    });
  });

  it("defaults region to empty (client maps it to auto) and pathStyle to false", () => {
    const cfg = resolveValidatedS3Config(base);
    expect(cfg?.region).toBe("");
    expect(cfg?.pathStyle).toBe(false);
    expect(cfg?.pathPrefix).toBe("");
    expect(cfg?.publicUrl).toBe("");
  });
});

describe("s3ObjectBodyToResponse", () => {
  const META = {
    contentType: "image/webp",
    contentLength: 11,
    etag: '"abc"',
  };

  function sdkBody(bytes: Uint8Array) {
    return {
      transformToByteArray: async () => bytes,
      transformToWebStream: () => new ReadableStream(),
    };
  }

  it("throws an explicit error when the SDK body is missing (previously a silent 200 with empty body)", async () => {
    await expect(s3ObjectBodyToResponse(undefined, META)).rejects.toThrow(
      /body is empty/i,
    );
    await expect(s3ObjectBodyToResponse(null, META)).rejects.toThrow(
      /body is empty/i,
    );
  });

  it("buffers small objects into complete bytes and keeps metadata headers", async () => {
    const res = await s3ObjectBodyToResponse(
      sdkBody(new TextEncoder().encode("hello-world")),
      META,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hello-world");
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("content-length")).toBe("11");
    expect(res.headers.get("etag")).toBe('"abc"');
  });

  it("buffers objects with unknown content length instead of streaming them", async () => {
    const res = await s3ObjectBodyToResponse(
      sdkBody(new TextEncoder().encode("bytes")),
      { contentType: "image/png" },
    );
    expect(await res.text()).toBe("bytes");
    expect(res.headers.get("content-length")).toBeNull();
  });

  it("streams large objects via transformToWebStream", async () => {
    const big = new Uint8Array(26 * 1024 * 1024); // > buffer limit (25MB)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(big);
        controller.close();
      },
    });
    const body = {
      transformToByteArray: async () => big,
      transformToWebStream: () => stream,
    };

    const res = await s3ObjectBodyToResponse(body, {
      ...META,
      contentLength: big.byteLength,
    });
    expect(res.body).not.toBeNull();
    const received = await res.arrayBuffer();
    expect(received.byteLength).toBe(big.byteLength);
  });

  it("falls back to buffering when the body has no web-stream transform", async () => {
    const res = await s3ObjectBodyToResponse(
      {
        transformToByteArray: async () =>
          new TextEncoder().encode("only-bytes"),
      },
      META,
    );
    expect(await res.text()).toBe("only-bytes");
  });

  it("throws an explicit error when the body cannot be read at all", async () => {
    await expect(s3ObjectBodyToResponse({}, META)).rejects.toThrow(
      /not readable/i,
    );
    await expect(
      s3ObjectBodyToResponse({ transformToWebStream: () => undefined }, META),
    ).rejects.toThrow(/not readable/i);
  });
});
