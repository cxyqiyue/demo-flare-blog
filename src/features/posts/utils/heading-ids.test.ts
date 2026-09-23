import { describe, expect, it } from "vitest";
import { headingAnchorId } from "@/features/posts/utils/heading-ids";

describe("headingAnchorId", () => {
  it("keeps a readable slug prefix plus hash for latin text", () => {
    expect(headingAnchorId("Deploy to Cloudflare Pages")).toMatch(
      /^deploy-to-cloudflare-pages-[0-9a-f]{6}$/,
    );
  });

  it("falls back to a hash for pure chinese headings instead of collapsing", () => {
    const id = headingAnchorId("部署前参数说明", 2);
    expect(id).toMatch(/^untitled-[0-9a-f]{8}-h2$/);
  });

  it("produces distinct ids for different chinese headings", () => {
    const a = headingAnchorId("部署教程");
    const b = headingAnchorId("常见问题");
    expect(a).not.toBe(b);
  });

  it("distinguishes headings whose slug collapsed to the same value", () => {
    const a = headingAnchorId("3、Variables变量");
    const b = headingAnchorId("3、部署Variables");
    expect(a).not.toBe(b);
    expect(a.startsWith("3variables-")).toBe(true);
  });

  it("is deterministic across calls", () => {
    expect(headingAnchorId("兼容性与迁移")).toBe(
      headingAnchorId("兼容性与迁移"),
    );
  });

  it("matches the level suffix only when level > 1", () => {
    expect(headingAnchorId("部署教程", 1)).not.toMatch(/-h1$/);
    expect(headingAnchorId("部署教程", 3)).toMatch(/-h3$/);
  });
});