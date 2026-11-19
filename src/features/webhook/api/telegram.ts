export interface TelegramChat {
  id: string;
  name: string;
  type: string;
}

interface TelegramChatObject {
  id: number;
  type: string;
  title?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
}

const CHAT_UPDATES = [
  "message",
  "edited_message",
  "channel_post",
  "my_chat_member",
] as const;

function chatName(chat: TelegramChatObject) {
  return (
    chat.title ||
    [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
    (chat.username ? `@${chat.username}` : String(chat.id))
  );
}

export async function listTelegramChats(
  token: string,
): Promise<Array<TelegramChat>> {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates?limit=100`,
    { signal: AbortSignal.timeout(10_000) },
  );
  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
    result?: Array<Record<string, { chat?: TelegramChatObject } | undefined>>;
  } | null;
  if (!body?.ok) {
    throw new Error(
      body?.description ?? `${response.status} ${response.statusText}`,
    );
  }
  const chats = new Map<string, TelegramChat>();
  for (const update of body.result ?? []) {
    for (const kind of CHAT_UPDATES) {
      const chat = update[kind]?.chat;
      if (chat) {
        const existing = chats.get(String(chat.id));
        const name = chatName(chat);
        chats.set(String(chat.id), {
          id: String(chat.id),
          name: name !== String(chat.id) ? name : (existing?.name ?? name),
          type: chat.type || existing?.type || "unknown",
        });
      }
    }
  }
  return [...chats.values()];
}
