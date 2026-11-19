import { describe, expect, it } from "vitest";
import type {
  WebhookContent,
  WebhookEndpoint,
} from "@/features/webhook/webhook.providers";
import {
  buildWebhookRequest,
  missingWebhookField,
  renderWebhookTemplate,
  webhookResponseError,
} from "@/features/webhook/webhook.providers";

const content: WebhookContent = {
  id: "msg_1",
  type: "comment.admin_root_created",
  timestamp: "2026-10-14T00:00:00.000Z",
  test: false,
  title: "Blog notification · New comment",
  message: 'Ada said: "Hello"\nhttps://example.com/post',
  url: "https://example.com/post",
  data: { commenterName: "Ada", postTitle: "Hello" },
};

function endpoint(fields: Partial<WebhookEndpoint>): WebhookEndpoint {
  return { url: "", secret: "", ...fields };
}

async function sent(fields: Partial<WebhookEndpoint>) {
  const request = await buildWebhookRequest(endpoint(fields), content, "{}");
  return { ...request, json: JSON.parse(request.body) as unknown };
}

describe("webhook provider requests", () => {
  it("renders JSON-escaped template variables, nested data and unknown values", () => {
    const body = renderWebhookTemplate(
      '{"text":"{{ message }}","name":"{{data.commenterName}}","empty":"{{missing}}"}',
      content,
      true,
    );
    expect(JSON.parse(body)).toEqual({
      text: content.message,
      name: "Ada",
      empty: "",
    });
  });

  it("sends the generic JSON body and signs timestamp plus body", async () => {
    const request = await buildWebhookRequest(
      endpoint({
        type: "generic",
        url: " https://hooks.example.com/n ",
        secret: "signing-key",
      }),
      content,
      '{"id":"msg_1"}',
    );
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("signing-key"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = Buffer.from(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`${content.timestamp}.{"id":"msg_1"}`),
      ),
    ).toString("hex");
    expect(request).toMatchObject({
      url: "https://hooks.example.com/n",
      body: '{"id":"msg_1"}',
      headers: { "X-Flare-Signature": `sha256=${signature}` },
    });
  });

  it("sends Telegram messages using Bot Token and Chat ID, not a saved URL", async () => {
    const request = await sent({
      type: "telegram",
      url: "https://legacy.example.com/old-webhook",
      botToken: "123:abc",
      chatId: "-10042",
    });
    expect(request.url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    expect(request.json).toEqual({
      chat_id: "-10042",
      text: `${content.title}\n${content.message}`,
    });
  });

  it("uses each platform's native message payload", async () => {
    const text = `${content.title}\n${content.message}`;
    expect(
      (await sent({ type: "discord", url: "https://discord/x" })).json,
    ).toEqual({ content: text });
    expect(
      (await sent({ type: "feishu", url: "https://feishu/x" })).json,
    ).toEqual({ msg_type: "text", content: { text } });
    expect(
      (await sent({ type: "dingtalk", url: "https://chat/x" })).json,
    ).toEqual({ msgtype: "text", text: { content: text } });
    expect((await sent({ type: "wecom", url: "https://chat/x" })).json).toEqual(
      {
        msgtype: "markdown",
        markdown: { content: `**${content.title}**\n> ${content.message}` },
      },
    );
  });

  it("targets Bark device keys and ntfy server roots", async () => {
    const bark = await sent({
      type: "bark",
      url: "https://api.day.app/DEVICE_KEY/ignored-path",
    });
    expect(bark.url).toBe("https://api.day.app/DEVICE_KEY");
    expect(bark.json).toEqual({
      title: content.title,
      body: content.message,
      url: content.url,
    });

    const ntfy = await sent({
      type: "ntfy",
      url: "https://ntfy.example.com/sub/my-topic",
    });
    expect(ntfy.url).toBe("https://ntfy.example.com/sub/");
    expect(ntfy.json).toEqual({
      topic: "my-topic",
      title: content.title,
      message: content.message,
      click: content.url,
    });

    const encodedTopic = await sent({
      type: "ntfy",
      url: "https://ntfy.example.com/my%2Ftopic",
    });
    expect(encodedTopic.json).toMatchObject({ topic: "my/topic" });

    const malformedTopic = await sent({
      type: "ntfy",
      url: "https://ntfy.example.com/topic%ZZ",
    });
    expect(malformedTopic.json).toMatchObject({ topic: "topic%ZZ" });
  });

  it("preserves WeCom test markers as real newlines", async () => {
    const request = await buildWebhookRequest(
      endpoint({ type: "wecom", url: "https://chat/x" }),
      { ...content, test: true },
      "{}",
    );
    expect(JSON.parse(request.body).markdown.content).toBe(
      `**${content.title}**\n> ${content.message}\n> \`[Test]\``,
    );
  });

  it("supports custom JSON and text templates with optional signing", async () => {
    const json = await buildWebhookRequest(
      endpoint({
        type: "custom",
        url: "https://custom/x",
        template: '{"message":"{{message}}"}',
      }),
      content,
      "{}",
    );
    expect(JSON.parse(json.body)).toEqual({ message: content.message });
    expect(json.headers).not.toHaveProperty("X-Flare-Signature");

    const text = await buildWebhookRequest(
      endpoint({
        type: "custom",
        url: "https://custom/x",
        secret: "key",
        template: "{{title}}: {{message}}",
      }),
      content,
      "{}",
    );
    expect(text.body).toBe(`${content.title}: ${content.message}`);
    expect(text.headers).toMatchObject({
      "Content-Type": "text/plain; charset=utf-8",
      "X-Flare-Signature": expect.stringMatching(/^sha256=/),
    });
  });
});

describe("webhook provider validation and errors", () => {
  it("identifies the next required field for each provider", () => {
    expect(
      missingWebhookField(endpoint({ type: "generic", url: "https://x" })),
    ).toBe("secret");
    expect(
      missingWebhookField(endpoint({ type: "telegram", botToken: "token" })),
    ).toBe("chatId");
    expect(
      missingWebhookField(endpoint({ type: "telegram", chatId: "42" })),
    ).toBe("botToken");
    expect(
      missingWebhookField(endpoint({ type: "discord", url: "not-a-url" })),
    ).toBe("url");
    expect(
      missingWebhookField(
        endpoint({ type: "discord", url: "https://discord/x" }),
      ),
    ).toBeNull();
    expect(
      missingWebhookField(
        endpoint({ type: "custom", url: "https://custom/x" }),
      ),
    ).toBe("template");
  });

  it("parses provider errors even when the HTTP response is successful", () => {
    expect(
      webhookResponseError(
        "telegram",
        true,
        '{"ok":false,"description":"chat not found"}',
      ),
    ).toBe("chat not found");
    expect(
      webhookResponseError(
        "dingtalk",
        true,
        '{"errcode":310000,"errmsg":"keyword missing"}',
      ),
    ).toBe("keyword missing");
    expect(
      webhookResponseError(
        "feishu",
        true,
        '{"code":19024,"msg":"keyword missing"}',
      ),
    ).toBe("keyword missing");
    expect(webhookResponseError("discord", true, "")).toBeNull();
  });
});
