import { describe, expect, it } from "vitest";
import { resolveValidatedS3Config } from "./s3-upload";

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
