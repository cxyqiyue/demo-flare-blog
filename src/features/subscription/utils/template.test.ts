import { describe, expect, it } from "vitest";
import {
  renderSubscriptionEmail,
  type SubscriptionEmailVars,
} from "./template";

const VARS: SubscriptionEmailVars = {
  articleTitle: "My First Post",
  articleUrl: "https://example.com/post/my-first-post",
  siteName: "Demo Blog",
};

describe("renderSubscriptionEmail", () => {
  it("uses fallback templates when config is empty and guarantees title + link", () => {
    const { subject, html } = renderSubscriptionEmail({
      config: null,
      vars: VARS,
      fallbackSubject: "[{site}] New article",
      fallbackBodyHtml: "<p>Hello</p>",
    });

    expect(subject).toBe("[{site}] New article - My First Post");
    expect(html).toContain("<p>Hello</p>");
    expect(html).toContain(`href="${VARS.articleUrl}"`);
    expect(html).toContain(VARS.articleTitle);
    expect(html).toContain("<!DOCTYPE html");
  });

  it("substitutes placeholders and skips the mandatory block when URL present", () => {
    const { subject, html } = renderSubscriptionEmail({
      config: {
        templateSubject: "{{siteName}} update",
        templateBody:
          '<p>Read <a href="{{articleUrl}}">{{articleTitle}}</a> on {{siteName}}</p>',
      },
      vars: VARS,
      fallbackSubject: "fallback",
      fallbackBodyHtml: "<p>fallback</p>",
    });

    expect(subject).toBe("Demo Blog update - My First Post");
    expect(html).toContain('href="https://example.com/post/my-first-post"');
    expect(html).toContain("My First Post");
    expect(html).not.toContain("border-top");
    expect(html).not.toContain("fallback");
  });

  it("escapes HTML-sensitive characters in substituted values", () => {
    const { html } = renderSubscriptionEmail({
      config: { templateBody: "<p>{{articleTitle}}</p>{{articleUrl}}" },
      vars: {
        ...VARS,
        articleTitle: 'A <b>"bold"</b> & tricky >title<',
      },
      fallbackSubject: "s",
      fallbackBodyHtml: "b",
    });

    expect(html).toContain(
      "A &lt;b&gt;&quot;bold&quot;&lt;/b&gt; &amp; tricky &gt;title&lt;",
    );
    expect(html).not.toContain("A <b>");
  });

  it("strips newlines from subjects", () => {
    const { subject } = renderSubscriptionEmail({
      config: { templateSubject: "line1\nline2\r\nline3" },
      vars: VARS,
      fallbackSubject: "f",
      fallbackBodyHtml: "b",
    });

    expect(subject).toBe("line1 line2 line3 - My First Post");
  });

  it("does not wrap bodies that are already complete documents", () => {
    const fullDoc =
      '<!DOCTYPE html><html><head></head><body style="color:red">no url here</body></html>';
    const { html } = renderSubscriptionEmail({
      config: { templateBody: fullDoc },
      vars: VARS,
      fallbackSubject: "s",
      fallbackBodyHtml: "b",
    });

    expect(html.startsWith(fullDoc)).toBe(true);
    expect((html.match(/<!DOCTYPE/gi) ?? []).length).toBe(1);
    expect(html).toContain(VARS.articleUrl);
  });
});
