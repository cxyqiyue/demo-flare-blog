import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderReact } from "./render";

describe("flare content rendering", () => {
  it("renders unhighlighted HTML code as text without creating HTML elements", () => {
    const html = renderToStaticMarkup(
      renderReact({
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language: "html" },
            content: [{ type: "text", text: '<img src=x onerror="alert(1)">' }],
          },
        ],
      }),
    );

    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).toContain("<pre");
  });
});
