import { describe, expect, it } from "vitest";
import {
  planImageProcessing,
  processImageBeforeUpload,
} from "./image-processing";

const MB = 1024 * 1024;

function makeFile(type: string, size: number): File {
  return new File([new Uint8Array(size)], `test.${type.split("/")[1]}`, {
    type,
  });
}

describe("planImageProcessing", () => {
  it("skips non-bitmap images regardless of limits", () => {
    expect(
      planImageProcessing(makeFile("image/gif", 20 * MB), {
        maxBytes: MB,
      }).action,
    ).toBe("skip");
    expect(
      planImageProcessing(makeFile("image/svg+xml", 20 * MB), {
        maxBytes: MB,
      }).action,
    ).toBe("skip");
    expect(
      planImageProcessing(makeFile("application/pdf", 20 * MB), {
        maxBytes: MB,
      }).action,
    ).toBe("skip");
  });

  it("skips images within the limit and without conversion", () => {
    const file = makeFile("image/png", 1024);
    const plan = planImageProcessing(file, { maxBytes: 10 * MB });
    expect(plan.action).toBe("skip");
    expect(plan.targetMime).toBe("image/png");
  });

  it("compresses oversize images to webp by default", () => {
    const plan = planImageProcessing(makeFile("image/png", 11 * MB), {
      maxBytes: 10 * MB,
    });
    expect(plan.action).toBe("compress");
    expect(plan.targetMime).toBe("image/webp");
  });

  it("respects compressEnabled=false", () => {
    const plan = planImageProcessing(makeFile("image/png", 11 * MB), {
      maxBytes: 10 * MB,
      compressEnabled: false,
    });
    expect(plan.action).toBe("skip");
  });

  it("converts when a target format is configured", () => {
    const png = makeFile("image/png", 1024);
    expect(
      planImageProcessing(png, { maxBytes: null, convertToFormat: "webp" }),
    ).toEqual({ action: "convert", targetMime: "image/webp" });
    expect(
      planImageProcessing(png, { maxBytes: null, convertToFormat: "jpeg" }),
    ).toEqual({ action: "convert", targetMime: "image/jpeg" });
    expect(
      planImageProcessing(makeFile("image/webp", 1024), {
        maxBytes: null,
        convertToFormat: "webp",
      }).action,
    ).toBe("skip");
  });

  it("compression wins over plain conversion", () => {
    const plan = planImageProcessing(makeFile("image/jpeg", 11 * MB), {
      maxBytes: 10 * MB,
      convertToFormat: "webp",
    });
    expect(plan.action).toBe("compress");
    expect(plan.targetMime).toBe("image/webp");
  });
});

describe("processImageBeforeUpload", () => {
  it("passes files through untouched when no processing applies", async () => {
    const file = makeFile("image/png", 2048);
    const result = await processImageBeforeUpload(file, { maxBytes: 10 * MB });
    expect(result.processed).toBe(false);
    expect(result.file).toBe(file);
    expect(result.originalSize).toBe(2048);
  });

  it("never blocks upload on canvas failures (gif passthrough)", async () => {
    const gif = makeFile("image/gif", 5 * MB);
    const result = await processImageBeforeUpload(gif, { maxBytes: MB });
    expect(result.file).toBe(gif);
    expect(result.processed).toBe(false);
  });
});
