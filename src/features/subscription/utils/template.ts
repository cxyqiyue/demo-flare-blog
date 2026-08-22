import type { SubscriptionConfig } from "@/features/config/config.schema";

export interface SubscriptionEmailVars {
  articleTitle: string;
  articleUrl: string;
  siteName: string;
}

export interface RenderSubscriptionEmailInput {
  config?: SubscriptionConfig | null;
  vars: SubscriptionEmailVars;
  fallbackSubject: string;
  fallbackBodyHtml: string;
}

const PLACEHOLDERS: Record<keyof SubscriptionEmailVars, string> = {
  articleTitle: "{{articleTitle}}",
  articleUrl: "{{articleUrl}}",
  siteName: "{{siteName}}",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeSubject(value: string): string {
  return value.replaceAll(/[\r\n]+/g, " ").trim();
}

function substitute(
  template: string,
  vars: SubscriptionEmailVars,
  escapeValues: boolean,
): string {
  let result = template;
  for (const key of Object.keys(PLACEHOLDERS) as Array<
    keyof SubscriptionEmailVars
  >) {
    const value = escapeValues ? escapeHtml(vars[key]) : vars[key];
    result = result.replaceAll(PLACEHOLDERS[key], value);
  }
  return result;
}

function buildMandatoryBlock(vars: SubscriptionEmailVars): string {
  const url = escapeHtml(vars.articleUrl);
  const title = escapeHtml(vars.articleTitle);
  return [
    '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e0e0e0;">',
    `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;"><a href="${url}" style="color:#1a73e8;text-decoration:none;">${title}</a></p>`,
    `<p style="margin:0;font-size:12px;color:#888;word-break:break-all;">${url}</p>`,
    "</div>",
  ].join("");
}

function wrapHtmlDocument(body: string): string {
  if (/<!doctype html|<html[\s>]/i.test(body)) {
    return body;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body style="margin:0;padding:24px;background:#ffffff;color:#222222;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;"><div style="max-width:600px;margin:0 auto;font-size:14px;line-height:1.7;">${body}</div></body></html>`;
}

export function renderSubscriptionEmail(
  input: RenderSubscriptionEmailInput,
): { subject: string; html: string } {
  const { config, vars } = input;

  const subjectTemplate =
    config?.templateSubject?.trim() || input.fallbackSubject;
  const bodyTemplate = config?.templateBody?.trim() || input.fallbackBodyHtml;

  let subject = substitute(sanitizeSubject(subjectTemplate), vars, false);
  if (!subject.includes(vars.articleTitle)) {
    subject = `${subject} - ${vars.articleTitle}`;
  }

  let body = substitute(bodyTemplate, vars, true);
  if (!body.includes(vars.articleUrl)) {
    body += buildMandatoryBlock(vars);
  }

  return { subject, html: wrapHtmlDocument(body) };
}
