import { describe, expect, it } from "vitest";
import {
  applyHighlightSyntax,
  guardCodeRegions,
  normalizeInlineHtmlTags,
  preprocessExtendedMarkdown,
  processFootnotes,
} from "./extended-markdown";

describe("guardCodeRegions", () => {
  it("protects fenced code and inline code spans", () => {
    const md = "text `a ==b==` and\n~~~\n[^1]: x\n~~~\nend";
    const { text, restore } = guardCodeRegions(md);
    expect(text).not.toContain("==b==");
    expect(text).not.toContain("[^1]");
    const restored = restore(text);
    expect(restored).toBe(md);
  });

  it("keeps placeholders unique per region", () => {
    const { text, restore } = guardCodeRegions("`x` and `y`");
    const placeholders = text.match(/EXTMD\d+/g) ?? [];
    expect(new Set(placeholders).size).toBe(2);
    expect(restore(text)).toBe("`x` and `y`");
  });
});

describe("processFootnotes", () => {
  it("returns input unchanged when no definitions exist", () => {
    const md = "hello [^1] world";
    expect(processFootnotes(md)).toBe(md);
  });

  it("collects definitions, replaces refs, appends section", () => {
    const md = [
      "Para one[^note] and second use[^note].",
      "",
      "[^note]: The definition **body**.",
      "",
      "Trailing paragraph.",
    ].join("\n");

    const out = processFootnotes(md, {
      renderInline: (s) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"),
    });

    // 定义从原位置移除
    expect(out).not.toMatch(/^\[\^note\]:/m);
    // 引用被替换为上标锚点，重复引用共享同一编号
    const refs = out.match(/<sup id="fnref-1"[^>]*>/g) ?? [];
    expect(refs.length).toBe(2);
    expect(out).toContain('<a href="#fn-1">[1]</a>');
    // 文末区块包含渲染后的正文与回链
    expect(out).toContain('<li id="fn-1">The definition <strong>body</strong>.');
    expect(out).toContain('class="footnote-backref" href="#fnref-1"');
    expect(out).toContain("</ol>\n</div>");
    // 原有段落保留
    expect(out).toContain("Para one");
    expect(out).toContain("Trailing paragraph.");
  });

  it("numbers multiple definitions in definition order", () => {
    const md = "A[^b] B[^a]\n\n[^a]: first\n\n[^b]: second";
    const out = processFootnotes(md);
    expect(out.indexOf('id="fn-1"')).toBeLessThan(out.indexOf('id="fn-2"'));
    expect(out).toContain("<li id=\"fn-1\">first");
    expect(out).toContain("<li id=\"fn-2\">second");
    // [^b] 引用指向第二个定义
    expect(out).toContain('<sup id="fnref-2" class="footnote-ref"><a href="#fn-2">[2]</a></sup>');
  });

  it("supports indented continuation lines", () => {
    const md = "X[^n]\n\n[^n]: line one\n    line two";
    const out = processFootnotes(md);
    expect(out).toContain("line one line two");
  });

  it("leaves unknown references untouched", () => {
    const md = "ref [^ghost] here\n\n[^real]: defined";
    const out = processFootnotes(md);
    expect(out).toContain("[^ghost]");
    expect(out).not.toContain('id="fnref-');
  });
});

describe("applyHighlightSyntax", () => {
  it("converts ==text== to mark tags", () => {
    expect(applyHighlightSyntax("a ==hi== b")).toBe("a <mark>hi</mark> b");
  });

  it("does not match across lines or empty content", () => {
    expect(applyHighlightSyntax("====")).toBe("====");
    expect(applyHighlightSyntax("==\n==")).toBe("==\n==");
  });

  it("respects code guards when composed manually", () => {
    const { text, restore } = guardCodeRegions("`==x==` plus ==y==");
    const replaced = applyHighlightSyntax(text);
    expect(replaced).toContain("<mark>y</mark>");
    expect(restore(replaced)).toBe("`==x==` plus <mark>y</mark>");
  });
});

describe("normalizeInlineHtmlTags", () => {
  it("converts kbd to inline code", () => {
    expect(normalizeInlineHtmlTags("press <kbd>Ctrl</kbd>+<kbd>C</kbd>")).toBe(
      "press `Ctrl`+`C`",
    );
  });

  it("strips nested tags inside kbd", () => {
    expect(normalizeInlineHtmlTags("<kbd><span>A</span></kbd>")).toBe("`A`");
  });
});

describe("preprocessExtendedMarkdown", () => {
  it("handles footnotes + highlight + kbd together", () => {
    const md = [
      "Note[^1] with ==highlight== and <kbd>Esc</kbd>.",
      "",
      "`==code==` stays",
      "",
      "[^1]: see ==this== too",
    ].join("\n");

    const out = preprocessExtendedMarkdown(md, {
      renderInline: (s) => applyHighlightSyntax(s),
      normalizeInlineHtml: true,
    });

    expect(out).toContain("<mark>highlight</mark>");
    expect(out).toContain("`Esc`");
    expect(out).toContain("`==code==`"); // 行内代码未被高亮替换
    expect(out).toContain("<mark>this</mark>");
    expect(out).toContain('id="fn-1"');
  });

  it("does not treat footnote-like text inside code fences as definitions", () => {
    const md = "para\n\n```\n[^fake]: inside code\n```\n";
    expect(preprocessExtendedMarkdown(md)).toBe(md);
  });
});
