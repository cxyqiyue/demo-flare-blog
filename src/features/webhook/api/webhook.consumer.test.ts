import { afterEach, describe, expect, it, vi } from "vitest";
import { sendWebhookRequest } from "@/features/webhook/api/webhook.consumer";

vi.mock("@/lib/env/server.env", () => ({
  serverEnv: () => ({ LOCALE: "en" }),
}));

describe("sendWebhookRequest", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("delivers Telegram messages without using a legacy endpoint URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendWebhookRequest(
      { env: {} as Env },
      {
        endpointId: "telegram-endpoint",
        type: "telegram",
        url: "https://legacy.example.com/webhook",
        botToken: "123:abc",
        chatId: "-10042",
        event: {
          type: "cloudflare.usage_alert",
          data: {
            subject: "Usage warning",
            message: "Usage is near the limit",
            html: "<p>Usage is near the limit</p>",
          },
        },
      },
      "message-1",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    expect(request.method).toBe("POST");
    expect(JSON.parse(request.body as string)).toMatchObject({
      chat_id: "-10042",
      text: "Usage warning\nUsage is near the limit",
    });
  });
});
