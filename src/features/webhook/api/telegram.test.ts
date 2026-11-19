import { afterEach, describe, expect, it, vi } from "vitest";
import { listTelegramChats } from "@/features/webhook/api/telegram";

describe("listTelegramChats", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("collects chats and keeps the newest known display name", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          result: [
            {
              message: { chat: { id: 12, type: "private", first_name: "Old" } },
            },
            {
              channel_post: {
                chat: { id: -100, type: "channel", title: "News" },
              },
            },
            {
              message: {
                chat: {
                  id: 12,
                  type: "private",
                  first_name: "Ada",
                  last_name: "Lovelace",
                },
              },
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listTelegramChats("123:abc")).resolves.toEqual([
      { id: "12", name: "Ada Lovelace", type: "private" },
      { id: "-100", name: "News", type: "channel" },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bot123:abc/getUpdates?limit=100",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("surfaces Telegram API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ ok: false, description: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          ),
        ),
    );

    await expect(listTelegramChats("bad-token")).rejects.toThrow(
      "Unauthorized",
    );
  });
});
