import { useMutation } from "@tanstack/react-query";
import {
  listTelegramChatsFn,
  testWebhookFn,
} from "@/features/webhook/api/webhook.api";

export function useWebhookConnection() {
  const mutation = useMutation({
    mutationFn: testWebhookFn,
  });
  const chats = useMutation({ mutationFn: listTelegramChatsFn });

  return {
    testWebhook: mutation.mutateAsync,
    testingEndpointId: mutation.variables?.data.endpoint.id,
    isTesting: mutation.isPending,
    listTelegramChats: chats.mutateAsync,
    isFindingChats: chats.isPending,
  };
}
