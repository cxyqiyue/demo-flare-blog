import { describe, expect, it } from "vitest";
import {
  markdownToPlainText,
  renderMarkdownToHtml,
} from "@/features/about/utils/markdown";

describe("renderMarkdownToHtml (about pipeline)", () => {
  it("renders GFM tables", () => {
    const html = renderMarkdownToHtml(
      "| a | b |\n| --- | --- |\n| 1 | 2 |",
    );
    expect(html).toContain("<table>");
    expect(html).toContain("<td>1</td>");
  });

  it("renders footnotes as anchored section", () => {
    const html = renderMarkdownToHtml(
      "Claim[^src].\n\n[^src]: The **source**.",
    );

    expect(html).toContain('<sup id="fnref-1" class="footnote-ref">');
    expect(html).toContain('href="#fn-1"');
    expect(html).toContain('<li id="fn-1">');
    // 脚注正文中的行内 Markdown 被渲染
    expect(html).toContain("<strong>source</strong>");
    expect(html).toContain('class="footnote-backref"');
  });

  it("renders ==highlight== syntax", () => {
    expect(renderMarkdownToHtml("a ==spot== b")).toContain(
      "a <mark>spot</mark> b",
    );
  });

  it("passes through inline HTML tags", () => {
    const html = renderMarkdownToHtml(
      "<kbd>Ctrl</kbd> and <mark>mk</mark> H<sub>2</sub>O <sup>up</sup>",
    );
    expect(html).toContain("<kbd>Ctrl</kbd>");
    expect(html).toContain("<sub>2</sub>");
    expect(html).toContain("<sup>up</sup>");
  });

  it("renders details blocks untouched", () => {
    const html = renderMarkdownToHtml(
      "<details>\n<summary>Title</summary>\n\nbody text\n\n</details>",
    );
    expect(html).toContain("<details>");
    expect(html).toContain("<summary>Title</summary>");
    expect(html).toContain("body text");
  });

  it("keeps code spans protected from extensions", () => {
    const html = renderMarkdownToHtml("`==raw==` and `[^1]: x`");
    expect(html).toContain("<code>==raw==</code>");
    expect(html).not.toContain("<mark>");
  });

  it("renders math formulas via katex", () => {
    const html = renderMarkdownToHtml("$E=mc^2$ and $$x_1$$");
    expect(html).toContain("katex");
    expect(html).toContain("about-math-inline");
    expect(html).toContain("about-math-block");
  });

  it("adds heading anchors", () => {
    const html = renderMarkdownToHtml("## Hello World");
    expect(html).toMatch(/<h2 id="hello-world">/);
  });
});

describe("markdownToPlainText", () => {
  it("strips markup including footnote sections", () => {
    const text = markdownToPlainText("Hi[^1]\n\n[^1]: note");
    expect(text).toContain("Hi [1]");
    expect(text).not.toContain("[^1]");
  });
});
