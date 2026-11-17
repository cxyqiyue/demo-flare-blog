import { describe, expect, it } from "vitest";
import {
  CreateMomentInputSchema,
  UpdateMomentInputSchema,
} from "./moments.schema";
import { resolveMomentVideo } from "./video";

describe("moment video addresses", () => {
  it("accepts video-only input and keeps omitted video distinct from explicit removal", () => {
    expect(
      CreateMomentInputSchema.parse({
        content: null,
        videoUrl: "https://cdn.example.com/video.mp4",
      }).videoUrl,
    ).toBe("https://cdn.example.com/video.mp4");
    expect(
      UpdateMomentInputSchema.parse({ id: 1, content: null }).videoUrl,
    ).toBeUndefined();
    expect(
      UpdateMomentInputSchema.parse({ id: 1, content: null, videoUrl: null })
        .videoUrl,
    ).toBeNull();
    expect(
      CreateMomentInputSchema.safeParse({
        content: null,
        videoUrl: "https://example.com/page",
      }).success,
    ).toBe(false);
  });
  it("normalizes supported platforms to fixed embed hosts", () => {
    expect(resolveMomentVideo("https://youtu.be/dQw4w9WgXcQ")?.src).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(
      resolveMomentVideo("https://www.bilibili.com/video/BV1xx411c7mD")?.kind,
    ).toBe("embed");
    expect(
      resolveMomentVideo("https://cdn.example.com/movie.mp4?token=abc")?.kind,
    ).toBe("direct");
  });
  it("rejects executable schemes, spoofed hosts and arbitrary pages", () => {
    for (const url of [
      "javascript:alert(1)",
      "https://youtube.com.evil.test/watch?v=dQw4w9WgXc",
      "https://example.com/page",
      "data:video/mp4;base64,AAAA",
    ])
      expect(resolveMomentVideo(url)).toBeNull();
  });
});
