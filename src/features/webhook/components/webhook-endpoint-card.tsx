import { Eye, EyeOff, KeyRound, Loader2, Send, Trash2 } from "lucide-react";
import type { FieldPath, FieldValues, UseFormRegister } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { NotificationWebhookEventType } from "@/features/webhook/webhook.schema";
import { NOTIFICATION_WEBHOOK_EVENTS } from "@/features/webhook/webhook.schema";
import { isFuwari } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";
import { WEBHOOK_EVENT_LABELS } from "./webhook-settings.helpers";

interface WebhookEndpointCardProps<TFieldValues extends FieldValues> {
  index: number;
  endpoint: {
    id: string;
    name: string;
    type?: string;
    url: string;
    enabled: boolean;
    secret?: string;
    events: Array<NotificationWebhookEventType>;
  };
  register: UseFormRegister<TFieldValues>;
  visibleSecret: boolean;
  fieldError?: {
    name?: { message?: string };
    url?: { message?: string };
    secret?: { message?: string };
    events?: { message?: string };
  };
  isTesting: boolean;
  testingEndpointId?: string | null;
  onRemove: () => void;
  onToggleEnabled: (checked: boolean) => void;
  onToggleSecretVisibility: () => void;
  onTypeChange: (type: string) => void;
  onToggleEvent: (
    eventType: NotificationWebhookEventType,
    checked: boolean,
  ) => void;
  onTest: () => void;
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
  onTypeChange,
  onTest,
}: WebhookEndpointCardProps<TFieldValues>) {
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

          <div className="flex items-center gap-3 md:gap-6">
            <Button
              type="button"
              variant="outline"
              onClick={onTest}
              disabled={isTesting && testingEndpointId === endpoint.id}
              className="h-9 rounded-xl px-4 text-xs font-medium fuwari-text-75 hover:text-(--fuwari-primary)"
            >
              {isTesting && testingEndpointId === endpoint.id ? (
                <Loader2 size={12} className="mr-2 animate-spin" />
              ) : (
                <Send size={12} className="mr-2" />
              )}
              {m.settings_webhook_endpoint_btn_test()}
            </Button>
            <label className="flex items-center gap-3 text-xs sm:text-sm fuwari-text-50">
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
              className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-destructive/5 hover:text-destructive"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <label className="block space-y-2">
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

            <label className="block space-y-2">
              <span className="block text-sm font-bold fuwari-text-75">
                {m.settings_webhook_endpoint_field_url()}
              </span>
              <Input
                {...register(
                  `notification.webhooks.${index}.url` as FieldPath<TFieldValues>,
                )}
                placeholder={m.settings_webhook_endpoint_field_url_ph()}
              />
              {fieldError?.url?.message && (
                <span className="text-xs text-destructive">
                  {fieldError.url.message}
                </span>
              )}
            </label>

            <label className="block space-y-2">
              <span className="block text-sm font-bold fuwari-text-75">
                {m.settings_webhook_endpoint_field_type()}
              </span>
              <select
                {...typeField}
                onChange={(event) => {
                  typeField.onChange(event);
                  onTypeChange(event.target.value);
                }}
                className="w-full rounded-xl border border-(--fuwari-input-border) bg-(--fuwari-input-bg) px-4 py-2.5 text-sm fuwari-text-90 focus:border-(--fuwari-primary)/50 focus:outline-none"
              >
                <option value="generic">
                  {m.settings_webhook_endpoint_type_generic()}
                </option>
                <option value="wecom">
                  {m.settings_webhook_endpoint_type_wecom()}
                </option>
              </select>
              {endpoint.type === "wecom" && (
                <span className="text-xs sm:text-sm fuwari-text-50">
                  {m.settings_webhook_endpoint_type_wecom_hint()}
                </span>
              )}
            </label>
          </div>

          {endpoint.type !== "wecom" && (
            <label className="block space-y-2">
              <span className="block text-sm font-bold fuwari-text-75">
                {m.settings_webhook_endpoint_field_secret()}
              </span>
              <div className="relative">
                <Input
                  type={visibleSecret ? "text" : "password"}
                  {...register(
                    `notification.webhooks.${index}.secret` as FieldPath<TFieldValues>,
                  )}
                  placeholder={m.settings_webhook_endpoint_field_secret_ph()}
                  className="pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onToggleSecretVisibility}
                  className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-lg text-muted-foreground/40 hover:text-foreground"
                >
                  {visibleSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                </Button>
              </div>
              <span className="flex items-center gap-2 text-xs sm:text-sm fuwari-text-50">
                <KeyRound size={12} className="shrink-0" />
                <span className="leading-5">
                  {m.settings_webhook_endpoint_field_secret_hint()}
                </span>
              </span>
              {fieldError?.secret?.message && (
                <span className="text-xs text-destructive">
                  {fieldError.secret.message}
                </span>
              )}
            </label>
          )}

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

        <div className="flex items-center gap-3 md:gap-6">
          <Button
            type="button"
            variant="outline"
            onClick={onTest}
            disabled={isTesting && testingEndpointId === endpoint.id}
            className="h-9 rounded-none px-4 text-[10px] font-mono uppercase tracking-[0.15em]"
          >
            {isTesting && testingEndpointId === endpoint.id ? (
              <Loader2 size={12} className="mr-2 animate-spin" />
            ) : (
              <Send size={12} className="mr-2" />
            )}
            {m.settings_webhook_endpoint_btn_test()}
          </Button>
          <label className="flex items-center gap-3 text-xs text-muted-foreground">
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
            className="h-9 w-9 rounded-none text-muted-foreground hover:bg-destructive/5 hover:text-destructive"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className="space-y-8 p-6">
        <div className="grid grid-cols-1 gap-x-12 gap-y-8 xl:grid-cols-2">
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

          <div className="space-y-3">
            <label className="text-sm text-muted-foreground">
              {m.settings_webhook_endpoint_field_url()}
            </label>
            <Input
              {...register(
                `notification.webhooks.${index}.url` as FieldPath<TFieldValues>,
              )}
              placeholder={m.settings_webhook_endpoint_field_url_ph()}
              className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm"
            />
            {fieldError?.url?.message && (
              <p className="text-xs text-red-500">! {fieldError.url.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-sm text-muted-foreground">
              {m.settings_webhook_endpoint_field_type()}
            </label>
            <select
              {...typeField}
              onChange={(event) => {
                typeField.onChange(event);
                onTypeChange(event.target.value);
              }}
              className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm"
            >
              <option value="generic">
                {m.settings_webhook_endpoint_type_generic()}
              </option>
              <option value="wecom">
                {m.settings_webhook_endpoint_type_wecom()}
              </option>
            </select>
            {endpoint.type === "wecom" && (
              <p className="text-xs text-muted-foreground">
                {m.settings_webhook_endpoint_type_wecom_hint()}
              </p>
            )}
          </div>
        </div>

        {endpoint.type !== "wecom" && (
          <div className="max-w-2xl space-y-3">
            <label className="text-sm text-muted-foreground">
              {m.settings_webhook_endpoint_field_secret()}
            </label>
            <div className="relative">
              <Input
                type={visibleSecret ? "text" : "password"}
                {...register(
                  `notification.webhooks.${index}.secret` as FieldPath<TFieldValues>,
                )}
                placeholder={m.settings_webhook_endpoint_field_secret_ph()}
                className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 pr-12 text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onToggleSecretVisibility}
                className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-none text-muted-foreground/40 hover:text-foreground"
              >
                {visibleSecret ? <EyeOff size={15} /> : <Eye size={15} />}
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <KeyRound size={12} className="shrink-0" />
              <p className="leading-5">
                {m.settings_webhook_endpoint_field_secret_hint()}
              </p>
            </div>
            {fieldError?.secret?.message && (
              <p className="text-xs text-red-500">
                ! {fieldError.secret.message}
              </p>
            )}
          </div>
        )}

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
