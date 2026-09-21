import { describe, expect, it } from "vitest";
import { joinFolderKey, normalizeFolderPath } from "./media.utils";

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
