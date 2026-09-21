import { describe, expect, it } from "vitest";
import {
  formatCopyLink,
  joinFolderKey,
  normalizeFolderPath,
  type SortableMediaFile,
  sortMediaFiles,
} from "./media.utils";

describe("normalizeFolderPath", () => {
  it("strips leading/trailing slashes", () => {
    expect(normalizeFolderPath("/images/ClaudeCodex/")).toBe(
      "images/ClaudeCodex",
    );
    expect(normalizeFolderPath("")).toBe("");
    expect(normalizeFolderPath("images")).toBe("images");
  });

  it("collapses repeated slashes", () => {
    expect(normalizeFolderPath("images//ClaudeCodex//")).toBe(
      "images/ClaudeCodex",
    );
    expect(normalizeFolderPath("images/ClaudeCodex//")).toBe(
      "images/ClaudeCodex",
    );
    expect(normalizeFolderPath("//images")).toBe("images");
  });
});

describe("joinFolderKey", () => {
  it("joins parent and name with a single trailing slash", () => {
    expect(joinFolderKey("", "photos")).toBe("photos/");
    expect(joinFolderKey("images", "ClaudeCodex")).toBe("images/ClaudeCodex/");
    expect(joinFolderKey("images/", "ClaudeCodex")).toBe("images/ClaudeCodex/");
  });
});

describe("formatCopyLink", () => {
  it("returns the bare url for the url format", () => {
    expect(formatCopyLink("url", "https://a.com/x.png", "x.png")).toBe(
      "https://a.com/x.png",
    );
  });

  it("wraps markdown, html and bbcode", () => {
    expect(formatCopyLink("markdown", "https://a.com/x.png", "x.png")).toBe(
      "![x.png](https://a.com/x.png)",
    );
    expect(formatCopyLink("html", "https://a.com/x.png", "x.png")).toBe(
      '<img src="https://a.com/x.png" alt="x.png" />',
    );
    expect(formatCopyLink("bbcode", "https://a.com/x.png", "x.png")).toBe(
      "[img]https://a.com/x.png[/img]",
    );
  });

  it("escapes html special characters", () => {
    expect(formatCopyLink("html", "https://a.com/a?b=1&c=2", 'a"<b>')).toBe(
      '<img src="https://a.com/a?b=1&amp;c=2" alt="a&quot;&lt;b&gt;" />',
    );
  });
});

describe("sortMediaFiles", () => {
  const files: SortableMediaFile[] = [
    { fileName: "b.png", sizeInBytes: 200, createdAt: new Date(2000) },
    { fileName: "a.png", sizeInBytes: 300, createdAt: new Date(3000) },
    { fileName: "c.png", sizeInBytes: 100, createdAt: new Date(1000) },
  ];

  it("sorts by name ascending/descending", () => {
    expect(sortMediaFiles(files, "name", "asc").map((f) => f.fileName)).toEqual(
      ["a.png", "b.png", "c.png"],
    );
    expect(sortMediaFiles(files, "name", "desc").map((f) => f.fileName)).toEqual(
      ["c.png", "b.png", "a.png"],
    );
  });

  it("sorts by size", () => {
    expect(sortMediaFiles(files, "size", "asc").map((f) => f.sizeInBytes)).toEqual(
      [100, 200, 300],
    );
    expect(
      sortMediaFiles(files, "size", "desc").map((f) => f.sizeInBytes),
    ).toEqual([300, 200, 100]);
  });

  it("sorts by time", () => {
    expect(
      sortMediaFiles(files, "time", "asc").map((f) => f.fileName),
    ).toEqual(["c.png", "b.png", "a.png"]);
  });

  it("always places null dates last", () => {
    const withNull: SortableMediaFile[] = [
      { fileName: "a.png", sizeInBytes: 1, createdAt: null },
      { fileName: "b.png", sizeInBytes: 2, createdAt: new Date(1000) },
      { fileName: "c.png", sizeInBytes: 3, createdAt: null },
    ];
    expect(
      sortMediaFiles(withNull, "time", "asc").map((f) => f.fileName),
    ).toEqual(["b.png", "a.png", "c.png"]);
    expect(
      sortMediaFiles(withNull, "time", "desc").map((f) => f.fileName),
    ).toEqual(["b.png", "a.png", "c.png"]);
  });

  it("does not mutate the input array", () => {
    const input = [...files];
    sortMediaFiles(input, "size", "desc");
    expect(input.map((f) => f.fileName)).toEqual(["b.png", "a.png", "c.png"]);
  });
});
