import type { WebhookType } from "@/features/webhook/webhook.schema";

export interface WebhookEndpoint {
  type?: WebhookType;
  url: string;
  secret?: string;
  botToken?: string;
  chatId?: string;
  template?: string;
}
export type WebhookProvider = WebhookType;

export interface WebhookContent {
  id: string;
  type: string;
  timestamp: string;
  test: boolean;
  title: string;
  message: string;
  url: string;
  data: Record<string, unknown>;
}

export interface WebhookRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

const SECRET_USE: Record<WebhookProvider, "required" | "optional" | "none"> = {
  generic: "required",
  telegram: "none",
  custom: "optional",
  discord: "none",
  feishu: "none",
  dingtalk: "none",
  wecom: "none",
  bark: "none",
  ntfy: "none",
};

export function providerOf(endpoint: Pick<WebhookEndpoint, "type">) {
  return endpoint.type ?? "generic";
}

export function webhookSecretUse(provider: WebhookProvider) {
  return SECRET_USE[provider];
}

export function missingWebhookField(
  endpoint: WebhookEndpoint,
): "url" | "secret" | "botToken" | "chatId" | "template" | null {
  const provider = providerOf(endpoint);
  if (provider === "telegram") {
    if (!endpoint.botToken?.trim()) return "botToken";
    return endpoint.chatId?.trim() ? null : "chatId";
  }
  if (!isHttpUrl(endpoint.url.trim())) return "url";
  if (SECRET_USE[provider] === "required" && !endpoint.secret?.trim())
    return "secret";
  if (provider === "custom" && !endpoint.template?.trim()) return "template";
  return null;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function isWebhookEmpty(endpoint: WebhookEndpoint) {
  return providerOf(endpoint) === "telegram"
    ? !endpoint.botToken?.trim() && !endpoint.chatId?.trim()
    : !endpoint.url.trim();
}

function variable(content: WebhookContent, name: string): string {
  const value = name.startsWith("data.")
    ? content.data[name.slice("data.".length)]
    : name in content && name !== "data"
      ? content[name as keyof Omit<WebhookContent, "data">]
      : undefined;
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (["number", "boolean", "bigint"].includes(typeof value))
    return String(value);
  return JSON.stringify(value) ?? "";
}

export function renderWebhookTemplate(
  template: string,
  content: WebhookContent,
  json: boolean,
) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, name: string) => {
    const value = variable(content, name);
    return json ? JSON.stringify(value).slice(1, -1) : value;
  });
}

const CHAT_TEXT = "{{title}}\\n{{message}}";
const literal = (value: string) => JSON.stringify(value);

function barkUrl(value: string) {
  const url = new URL(value);
  const key = url.pathname.split("/").find(Boolean) ?? "";
  return `${url.origin}/${key}`;
}

function ntfyTarget(value: string) {
  const url = new URL(value);
  const segments = url.pathname.split("/").filter(Boolean);
  const topic = segments.pop() ?? "";
  let decodedTopic = topic;
  try {
    decodedTopic = decodeURIComponent(topic);
  } catch {
    // Keep malformed percent escapes literal instead of failing the delivery.
  }
  return {
    url: `${url.origin}/${segments.map((part) => `${part}/`).join("")}`,
    topic: decodedTopic,
  };
}

export function presetRequestTemplate(
  provider: Exclude<WebhookProvider, "generic" | "custom">,
  endpoint: Pick<WebhookEndpoint, "url" | "chatId">,
  token: string,
): { url: string; template: string } {
  switch (provider) {
    case "telegram":
      return {
        url: `https://api.telegram.org/bot${token}/sendMessage`,
        template: `{"chat_id": ${literal(endpoint.chatId?.trim() ?? "")}, "text": "${CHAT_TEXT}"}`,
      };
    case "discord":
      return { url: endpoint.url, template: `{"content": "${CHAT_TEXT}"}` };
    case "feishu":
      return {
        url: endpoint.url,
        template: `{"msg_type": "text", "content": {"text": "${CHAT_TEXT}"}}`,
      };
    case "dingtalk":
      return {
        url: endpoint.url,
        template: `{"msgtype": "text", "text": {"content": "${CHAT_TEXT}"}}`,
      };
    case "wecom":
      return {
        url: endpoint.url,
        template:
          '{"msgtype": "markdown", "markdown": {"content": "**{{title}}**\\n> {{message}}{{testSuffix}}"}}',
      };
    case "bark":
      return {
        url: isHttpUrl(endpoint.url) ? barkUrl(endpoint.url) : endpoint.url,
        template:
          '{"title": "{{title}}", "body": "{{message}}", "url": "{{url}}"}',
      };
    case "ntfy": {
      if (!isHttpUrl(endpoint.url)) return { url: endpoint.url, template: "" };
      const target = ntfyTarget(endpoint.url);
      return {
        url: target.url,
        template: `{"topic": ${literal(target.topic)}, "title": "{{title}}", "message": "{{message}}", "click": "{{url}}"}`,
      };
    }
    default: {
      provider satisfies never;
      throw new Error("Unknown webhook provider");
    }
  }
}

async function hmacHex(secret: string, text: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(text));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function flareHeaders(
  content: WebhookContent,
  secret: string,
  body: string,
) {
  return {
    "X-Flare-Event": content.type,
    "X-Flare-Timestamp": content.timestamp,
    "X-Flare-Signature": `sha256=${await hmacHex(secret, `${content.timestamp}.${body}`)}`,
  };
}

export async function buildWebhookRequest(
  endpoint: WebhookEndpoint,
  content: WebhookContent,
  genericBody: string,
): Promise<WebhookRequest> {
  const provider = providerOf(endpoint);
  if (provider === "generic") {
    return {
      url: endpoint.url.trim(),
      headers: {
        "Content-Type": "application/json",
        ...(await flareHeaders(content, endpoint.secret ?? "", genericBody)),
      },
      body: genericBody,
    };
  }
  if (provider === "custom") {
    const template = endpoint.template ?? "";
    const json = renderWebhookTemplate(template, content, true);
    let isJson = true;
    try {
      JSON.parse(json);
    } catch {
      isJson = false;
    }
    const body = isJson
      ? json
      : renderWebhookTemplate(template, content, false);
    return {
      url: endpoint.url.trim(),
      headers: {
        "Content-Type": isJson
          ? "application/json"
          : "text/plain; charset=utf-8",
        ...(endpoint.secret
          ? await flareHeaders(content, endpoint.secret, body)
          : {}),
      },
      body,
    };
  }
  const preset = presetRequestTemplate(
    provider,
    {
      url: provider === "telegram" ? "" : endpoint.url.trim(),
      chatId: endpoint.chatId,
    },
    endpoint.botToken?.trim() ?? "",
  );
  const templateContent =
    provider === "wecom"
      ? {
          ...content,
          testSuffix: content.test ? "\n> `[Test]`" : "",
        }
      : content;
  return {
    url: preset.url,
    headers: { "Content-Type": "application/json" },
    body: renderWebhookTemplate(preset.template, templateContent, true),
  };
}

export function webhookResponseError(
  provider: WebhookProvider,
  ok: boolean,
  text: string,
): string | null {
  let json: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object")
      json = parsed as Record<string, unknown>;
  } catch {
    /* Use the raw service response below. */
  }
  const field = (name: string) =>
    typeof json?.[name] === "string" ? (json[name] as string) : "";
  const code = (name: string) =>
    typeof json?.[name] === "number" ? (json[name] as number) : 0;
  switch (provider) {
    case "telegram":
      if (json?.ok === false)
        return field("description") || text || "Telegram rejected the message";
      break;
    case "feishu":
      if (code("code") || code("StatusCode"))
        return field("msg") || field("StatusMessage") || text;
      break;
    case "dingtalk":
    case "wecom":
      if ("errcode" in (json ?? {})) {
        if (code("errcode") !== 0) return field("errmsg") || text;
        if (ok) return null;
      }
      break;
    default:
      break;
  }
  if (ok) return null;
  return field("description") || field("message") || field("error") || text;
}
