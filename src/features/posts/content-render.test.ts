import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { markdownToJsonContent } from "@/features/import-export/utils/markdown-parser";
import { renderReact } from "@/features/theme/themes/default/components/content/render";
import { sanitizeJsonContent } from "@/lib/utils";

const SAMPLE = [
  "# 标题",
  "",
  "## 二级标题",
  "",
  "| 功能 | 状态 |",
  "| ---- | :--: |",
  "| 表格 | ✅ |",
  "",
  "```js",
  "const x = 1;",
  "```",
  "",
  "- [ ] task",
  "- [x] done",
  "",
  "> quote",
  "",
  "$E = mc^2$ and $$\\int_0^1 x dx$$",
  "",
  "##### h5 heading",
  "",
  "###### h6 heading",
  "",
  "footnote[^1] ref with ==highlight== and <kbd>Ctrl</kbd>",
  "",
  "[^1]: note text",
].join("\n");

/**
 * 端到端渲染检查：Markdown → JSON → static-renderer 输出
 * 保证转换产物与前台扩展集完全匹配（不丢节点、不抛异常）。
 */
describe("published post rendering (markdown mode -> ContentRenderer)", () => {
  it("converts sample markdown and renders all features", async () => {
    const json = await markdownToJsonContent(SAMPLE);
    const safe = sanitizeJsonContent(json);
    expect(safe).toBeTruthy();
    const el = renderReact(safe!);
    const html = renderToStaticMarkup(React.createElement("div", null, el));

    expect(html).toContain("<table");
    // 表格宽度受容器约束（width:100% + auto layout），长内容自动换行而非撑破容器
    expect(html).toContain(
      '<table class="w-full border-collapse content-table"',
    );
    expect(html).not.toContain("w-max");
    expect(html).toContain("<pre");
    expect(html).toContain('data-type="taskList"');
    expect(html).toContain("<blockquote");
    // h5/h6 标题保留
    expect(html).toContain("<h5");
    expect(html).toContain("<h6");
    // 脚注引用被解析（不再残留字面 [^1]）
    expect(html).not.toContain("[^1]:");
    expect(html).toContain("<sup");
    expect(html).toContain("#fn-1");
    // 高亮 mark 与行内 kbd→code
    expect(html).toContain("<mark");
    expect(html).not.toContain("<kbd");
    expect(html).toContain("Ctrl");
  });

  it("keeps footnote definition content in the rendered list", async () => {
    const json = await markdownToJsonContent(SAMPLE);
    const safe = sanitizeJsonContent(json);
    const el = renderReact(safe!);
    const html = renderToStaticMarkup(React.createElement("div", null, el));

    expect(html).toContain("note text");
  });
});
