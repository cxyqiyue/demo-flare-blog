import { Eye, EyeOff, Loader2, Search, Send, Trash2 } from "lucide-react";
import type { FieldPath, FieldValues, UseFormRegister } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  NotificationWebhookEventType,
  WebhookType,
} from "@/features/webhook/webhook.schema";
import {
  NOTIFICATION_WEBHOOK_EVENTS,
  WEBHOOK_TYPES,
} from "@/features/webhook/webhook.schema";
import { isFuwari } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";
import { WEBHOOK_EVENT_LABELS } from "./webhook-settings.helpers";

const PROVIDER_LABELS = {
  generic: () => m.settings_webhook_provider_generic(),
  telegram: () => m.settings_webhook_provider_telegram(),
  discord: () => m.settings_webhook_provider_discord(),
  feishu: () => m.settings_webhook_provider_feishu(),
  dingtalk: () => m.settings_webhook_provider_dingtalk(),
  wecom: () => m.settings_webhook_provider_wecom(),
  bark: () => m.settings_webhook_provider_bark(),
  ntfy: () => m.settings_webhook_provider_ntfy(),
  custom: () => m.settings_webhook_provider_custom(),
};

const PROVIDER_HINTS = {
  discord: () => m.settings_webhook_hint_discord(),
  feishu: () => m.settings_webhook_hint_feishu(),
  dingtalk: () => m.settings_webhook_hint_dingtalk(),
  wecom: () => m.settings_webhook_hint_wecom(),
  bark: () => m.settings_webhook_hint_bark(),
  ntfy: () => m.settings_webhook_hint_ntfy(),
};

const PROVIDER_URL_PLACEHOLDERS: Record<
  Exclude<WebhookType, "telegram">,
  () => string
> = {
  generic: () => m.settings_webhook_endpoint_field_url_ph(),
  discord: () => "https://discord.com/api/webhooks/…",
  feishu: () => "https://open.feishu.cn/open-apis/bot/v2/hook/…",
  dingtalk: () => "https://oapi.dingtalk.com/robot/send?access_token=…",
  wecom: () => "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…",
  bark: () => "https://api.day.app/…",
  ntfy: () => "https://ntfy.sh/your-topic",
  custom: () => m.settings_webhook_endpoint_field_url_ph(),
};

interface WebhookEndpointCardProps<TFieldValues extends FieldValues> {
  index: number;
  endpoint: {
    id: string;
    name: string;
    type?: string;
    url: string;
    enabled: boolean;
    secret?: string;
    botToken?: string;
    chatId?: string;
    template?: string;
    events: Array<NotificationWebhookEventType>;
  };
  register: UseFormRegister<TFieldValues>;
  visibleSecret: boolean;
  fieldError?: {
    name?: { message?: string };
    url?: { message?: string };
    secret?: { message?: string };
    botToken?: { message?: string };
    chatId?: { message?: string };
    template?: { message?: string };
    events?: { message?: string };
  };
  isTesting: boolean;
  testingEndpointId?: string | null;
  onRemove: () => void;
  onToggleEnabled: (checked: boolean) => void;
  onToggleSecretVisibility: () => void;
  onToggleEvent: (
    eventType: NotificationWebhookEventType,
    checked: boolean,
  ) => void;
  onTest: () => void;
  isFindingChats: boolean;
  chats: Array<{ id: string; name: string; type: string }>;
  hasSearchedChats: boolean;
  onFindChats: () => void;
  onSelectChat: (chatId: string) => void;
}

interface ProviderFieldsProps<TFieldValues extends FieldValues> {
  index: number;
  endpoint: WebhookEndpointCardProps<TFieldValues>["endpoint"];
  provider: string;
  register: UseFormRegister<TFieldValues>;
  visibleSecret: boolean;
  fieldError?: WebhookEndpointCardProps<TFieldValues>["fieldError"];
  onToggleSecretVisibility: () => void;
  onFindChats: () => void;
  onSelectChat: (chatId: string) => void;
  isFindingChats: boolean;
  chats: Array<{ id: string; name: string; type: string }>;
  hasSearchedChats: boolean;
  theme: "fuwari" | "default";
}

function ProviderFields<TFieldValues extends FieldValues>({
  index,
  endpoint,
  provider,
  register,
  visibleSecret,
  fieldError,
  onToggleSecretVisibility,
  onFindChats,
  onSelectChat,
  isFindingChats,
  chats,
  hasSearchedChats,
  theme,
}: ProviderFieldsProps<TFieldValues>) {
  const fuwari = theme === "fuwari";
  const inputClass = fuwari
    ? ""
    : "w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm";
  const labelClass = fuwari
    ? "block min-w-0 space-y-2 text-sm font-bold fuwari-text-75"
    : "block min-w-0 space-y-3 text-sm text-muted-foreground";
  const chatIdPath =
    `notification.webhooks.${index}.chatId` as FieldPath<TFieldValues>;
  const tokenPath =
    `notification.webhooks.${index}.${provider === "telegram" ? "botToken" : "secret"}` as FieldPath<TFieldValues>;
  const templatePath =
    `notification.webhooks.${index}.template` as FieldPath<TFieldValues>;
  const hasSecret =
    provider === "generic" || provider === "custom" || provider === "telegram";

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {provider === "telegram" && (
        <>
          <label className={labelClass}>
            {m.settings_webhook_field_bot_token()}
            <div className="relative">
              <Input
                type={visibleSecret ? "text" : "password"}
                autoComplete="new-password"
                {...register(tokenPath)}
                placeholder="123456:ABC-…"
                className={`${inputClass} pr-14`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onToggleSecretVisibility}
                className="absolute right-1 top-1/2 -translate-y-1/2"
                aria-label={
                  visibleSecret
                    ? m.settings_webhook_hide_secret()
                    : m.settings_webhook_show_secret()
                }
              >
                {visibleSecret ? <EyeOff size={15} /> : <Eye size={15} />}
              </Button>
            </div>
            {fieldError?.botToken?.message && (
              <span className="text-xs text-destructive">
                {fieldError.botToken.message}
              </span>
            )}
          </label>
          <div className="space-y-3">
            <label className={labelClass}>
              {m.settings_webhook_field_chat_id()}
              <Input
                {...register(chatIdPath)}
                placeholder={m.settings_webhook_field_chat_id_ph()}
                className={inputClass}
              />
            </label>
            {fieldError?.chatId?.message && (
              <p className="text-xs text-destructive">
                {fieldError.chatId.message}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onFindChats}
              disabled={isFindingChats || !endpoint.botToken?.trim()}
              className="min-h-11 w-full sm:w-auto"
            >
              <Search size={15} />
              {isFindingChats
                ? m.settings_webhook_loading_chats()
                : m.settings_webhook_find_chats()}
            </Button>
            {chats.length > 0 && (
              <div
                className="flex flex-wrap gap-2"
                aria-label={m.settings_webhook_chats_found()}
              >
                {chats.map((chat) => (
                  <Button
                    key={chat.id}
                    type="button"
                    variant="outline"
                    className="min-h-11 max-w-full"
                    onClick={() => onSelectChat(chat.id)}
                  >
                    <span className="truncate">
                      {chat.name} · {chat.type}
                    </span>
                  </Button>
                ))}
              </div>
            )}
            {hasSearchedChats && !isFindingChats && chats.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {m.settings_webhook_chats_empty()}
              </p>
            )}
          </div>
        </>
      )}

      {provider === "custom" && (
        <label className={`${labelClass} xl:col-span-2`}>
          {m.settings_webhook_field_template()}
          <Textarea
            {...register(templatePath)}
            rows={7}
            spellCheck={false}
            className="font-mono text-xs sm:text-sm"
            placeholder={
              '{"title":"{{title}}","message":"{{message}}","url":"{{url}}"}'
            }
          />
          <span className="text-xs font-normal text-muted-foreground">
            {m.settings_webhook_template_variables()}:{" "}
            {
              "{{title}} · {{message}} · {{url}} · {{type}} · {{timestamp}} · {{data.*}}"
            }
          </span>
          {fieldError?.template?.message && (
            <span className="text-xs text-destructive">
              {fieldError.template.message}
            </span>
          )}
        </label>
      )}

      {hasSecret && provider !== "telegram" && (
        <label
          className={`${labelClass} ${provider === "custom" ? "xl:col-span-2" : ""}`}
        >
          {provider === "generic"
            ? m.settings_webhook_endpoint_field_secret()
            : m.settings_webhook_field_secret_optional()}
          <div className="relative">
            <Input
              type={visibleSecret ? "text" : "password"}
              autoComplete="new-password"
              {...register(tokenPath)}
              placeholder={
                provider === "generic"
                  ? m.settings_webhook_endpoint_field_secret_ph()
                  : m.settings_webhook_secret_optional_ph()
              }
              className={`${inputClass} pr-14`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleSecretVisibility}
              className="absolute right-1 top-1/2 -translate-y-1/2"
              aria-label={
                visibleSecret
                  ? m.settings_webhook_hide_secret()
                  : m.settings_webhook_show_secret()
              }
            >
              {visibleSecret ? <EyeOff size={15} /> : <Eye size={15} />}
            </Button>
          </div>
          <span className="text-xs font-normal text-muted-foreground">
            {provider === "generic"
              ? m.settings_webhook_endpoint_field_secret_hint()
              : m.settings_webhook_custom_secret_hint()}
          </span>
          {fieldError?.secret?.message && (
            <span className="text-xs text-destructive">
              {fieldError.secret.message}
            </span>
          )}
        </label>
      )}

      {provider !== "generic" &&
        provider !== "telegram" &&
        provider !== "custom" && (
          <p className="text-xs text-muted-foreground xl:col-span-2">
            {PROVIDER_HINTS[provider as keyof typeof PROVIDER_HINTS]()}
          </p>
        )}
    </div>
  );
}

export function WebhookEndpointCard<TFieldValues extends FieldValues>({
  index,
  endpoint,
  register,
  visibleSecret,
  fieldError,
  isTesting,
  testingEndpointId,
  onRemove,
  onToggleEnabled,
  onToggleEvent,
  onToggleSecretVisibility,
  onTest,
  isFindingChats,
  chats,
  hasSearchedChats,
  onFindChats,
  onSelectChat,
}: WebhookEndpointCardProps<TFieldValues>) {
  const provider = endpoint.type ?? "generic";
  const typeField = register(
    `notification.webhooks.${index}.type` as FieldPath<TFieldValues>,
  );

  if (isFuwari) {
    return (
      <div className="overflow-hidden rounded-xl border border-(--fuwari-input-border) bg-(--fuwari-card-bg)">
        <div className="flex flex-col gap-4 border-b border-(--fuwari-input-border) bg-(--fuwari-btn-regular-bg)/40 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-0.5">
            <p className="text-xs sm:text-sm fuwari-text-50">
              {m.settings_webhook_endpoint_label({
                index: String(index + 1).padStart(2, "0"),
              })}
            </p>
            <p className="text-base font-bold fuwari-text-90">
              {endpoint.name.trim() || m.settings_webhook_endpoint_unnamed()}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-6">
            <Button
              type="button"
              variant="outline"
              onClick={onTest}
              disabled={isTesting && testingEndpointId === endpoint.id}
              className="min-h-11 rounded-xl px-4 text-xs font-medium fuwari-text-75 hover:text-(--fuwari-primary)"
            >
              {isTesting && testingEndpointId === endpoint.id ? (
                <Loader2 size={12} className="mr-2 animate-spin" />
              ) : (
                <Send size={12} className="mr-2" />
              )}
              {m.settings_webhook_endpoint_btn_test()}
            </Button>
            <label className="flex min-h-11 items-center gap-3 text-xs sm:text-sm fuwari-text-50">
              <Checkbox
                checked={endpoint.enabled}
                onCheckedChange={onToggleEnabled}
              />
              {m.settings_webhook_endpoint_enable_label()}
            </label>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="min-h-11 min-w-11 rounded-lg text-muted-foreground hover:bg-destructive/5 hover:text-destructive"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <label className="block min-w-0 space-y-2">
              <span className="block text-sm font-bold fuwari-text-75">
                {m.settings_webhook_endpoint_field_name()}
              </span>
              <Input
                {...register(
                  `notification.webhooks.${index}.name` as FieldPath<TFieldValues>,
                )}
                placeholder={m.settings_webhook_endpoint_field_name_ph()}
              />
              {fieldError?.name?.message && (
                <span className="text-xs text-destructive">
                  {fieldError.name.message}
                </span>
              )}
            </label>

            {provider !== "telegram" && (
              <label className="block min-w-0 space-y-2">
                <span className="block text-sm font-bold fuwari-text-75">
                  {m.settings_webhook_endpoint_field_url()}
                </span>
                <Input
                  type="url"
                  inputMode="url"
                  {...register(
                    `notification.webhooks.${index}.url` as FieldPath<TFieldValues>,
                  )}
                  placeholder={PROVIDER_URL_PLACEHOLDERS[
                    provider as Exclude<WebhookType, "telegram">
                  ]()}
                />
                {fieldError?.url?.message && (
                  <span className="text-xs text-destructive">
                    {fieldError.url.message}
                  </span>
                )}
              </label>
            )}

            <label className="block space-y-2">
              <span className="block text-sm font-bold fuwari-text-75">
                {m.settings_webhook_endpoint_field_type()}
              </span>
              <select
                {...typeField}
                className="w-full rounded-xl border border-(--fuwari-input-border) bg-(--fuwari-input-bg) px-4 py-2.5 text-sm fuwari-text-90 focus:border-(--fuwari-primary)/50 focus:outline-none"
              >
                {WEBHOOK_TYPES.map((provider) => (
                  <option key={provider} value={provider}>
                    {PROVIDER_LABELS[provider]()}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ProviderFields
            index={index}
            endpoint={endpoint}
            provider={provider}
            register={register}
            visibleSecret={visibleSecret}
            fieldError={fieldError}
            onToggleSecretVisibility={onToggleSecretVisibility}
            onFindChats={onFindChats}
            onSelectChat={onSelectChat}
            isFindingChats={isFindingChats}
            chats={chats}
            hasSearchedChats={hasSearchedChats}
            theme="fuwari"
          />

          <div className="space-y-4">
            <div className="space-y-0.5">
              <h6 className="text-sm font-bold fuwari-text-75">
                {m.settings_webhook_events_title()}
              </h6>
              <p className="text-xs sm:text-sm fuwari-text-50">
                {m.settings_webhook_events_desc()}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
              {NOTIFICATION_WEBHOOK_EVENTS.map((eventType) => {
                const checked = endpoint.events.includes(eventType);

                return (
                  <label
                    key={eventType}
                    className="flex cursor-pointer gap-4 rounded-xl border border-(--fuwari-input-border) bg-(--fuwari-btn-regular-bg) px-4 py-3 transition-colors hover:border-(--fuwari-primary)/40"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(nextChecked) =>
                        onToggleEvent(eventType, nextChecked)
                      }
                    />
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-bold fuwari-text-90">
                        {WEBHOOK_EVENT_LABELS[eventType]}
                      </p>
                      <p className="break-all text-xs sm:text-sm fuwari-text-50">
                        {eventType}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
            {fieldError?.events?.message && (
              <p className="text-xs text-destructive">
                {fieldError.events.message}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-border/30 bg-muted/5">
      <div className="flex flex-col gap-4 border-b border-border/20 px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {m.settings_webhook_endpoint_label({
              index: String(index + 1).padStart(2, "0"),
            })}
          </p>
          <p className="text-base font-serif text-foreground">
            {endpoint.name.trim() || m.settings_webhook_endpoint_unnamed()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-6">
          <Button
            type="button"
            variant="outline"
            onClick={onTest}
            disabled={isTesting && testingEndpointId === endpoint.id}
            className="min-h-11 rounded-none px-4 text-[10px] font-mono uppercase tracking-[0.15em]"
          >
            {isTesting && testingEndpointId === endpoint.id ? (
              <Loader2 size={12} className="mr-2 animate-spin" />
            ) : (
              <Send size={12} className="mr-2" />
            )}
            {m.settings_webhook_endpoint_btn_test()}
          </Button>
          <label className="flex min-h-11 items-center gap-3 text-xs text-muted-foreground">
            <Checkbox
              checked={endpoint.enabled}
              onCheckedChange={onToggleEnabled}
            />
            {m.settings_webhook_endpoint_enable_label()}
          </label>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="min-h-11 min-w-11 rounded-none text-muted-foreground hover:bg-destructive/5 hover:text-destructive"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:space-y-8 sm:p-6">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 xl:grid-cols-2">
          <div className="space-y-3">
            <label className="text-sm text-muted-foreground">
              {m.settings_webhook_endpoint_field_name()}
            </label>
            <Input
              {...register(
                `notification.webhooks.${index}.name` as FieldPath<TFieldValues>,
              )}
              placeholder={m.settings_webhook_endpoint_field_name_ph()}
              className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm"
            />
            {fieldError?.name?.message && (
              <p className="text-xs text-red-500">
                ! {fieldError.name.message}
              </p>
            )}
          </div>

          {provider !== "telegram" && (
            <div className="min-w-0 space-y-3">
              <label className="text-sm text-muted-foreground">
                {m.settings_webhook_endpoint_field_url()}
              </label>
              <Input
                type="url"
                inputMode="url"
                {...register(
                  `notification.webhooks.${index}.url` as FieldPath<TFieldValues>,
                )}
                placeholder={PROVIDER_URL_PLACEHOLDERS[
                  provider as Exclude<WebhookType, "telegram">
                ]()}
                className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm"
              />
              {fieldError?.url?.message && (
                <p className="text-xs text-red-500">
                  ! {fieldError.url.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <label className="text-sm text-muted-foreground">
              {m.settings_webhook_endpoint_field_type()}
            </label>
            <select
              {...typeField}
              className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm"
            >
              {WEBHOOK_TYPES.map((value) => (
                <option key={value} value={value}>
                  {PROVIDER_LABELS[value]()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ProviderFields
          index={index}
          endpoint={endpoint}
          provider={provider}
          register={register}
          visibleSecret={visibleSecret}
          fieldError={fieldError}
          onToggleSecretVisibility={onToggleSecretVisibility}
          onFindChats={onFindChats}
          onSelectChat={onSelectChat}
          isFindingChats={isFindingChats}
          chats={chats}
          hasSearchedChats={hasSearchedChats}
          theme="default"
        />

        <div className="space-y-5">
          <div className="space-y-1">
            <h6 className="text-sm font-medium text-foreground">
              {m.settings_webhook_events_title()}
            </h6>
            <p className="text-sm text-muted-foreground">
              {m.settings_webhook_events_desc()}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {NOTIFICATION_WEBHOOK_EVENTS.map((eventType) => {
              const checked = endpoint.events.includes(eventType);

              return (
                <label
                  key={eventType}
                  className="flex cursor-pointer gap-4 border border-border/25 bg-background/40 px-4 py-4 transition-colors hover:bg-muted/5"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(nextChecked) =>
                      onToggleEvent(eventType, nextChecked)
                    }
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {WEBHOOK_EVENT_LABELS[eventType]}
                    </p>
                    <p className="break-all text-xs text-muted-foreground">
                      {eventType}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
          {fieldError?.events?.message && (
            <p className="text-xs text-red-500">
              ! {fieldError.events.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
