import { BellRing } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SystemConfig } from "@/features/config/config.schema";
import { SUBSCRIPTION_TEMPLATE_PLACEHOLDERS } from "@/features/config/config.schema";
import { isFuwari } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";

export function SubscriptionSettingsSection() {
  const { register, watch, setValue } = useFormContext<SystemConfig>();

  const allUserNotifyEnabled =
    watch("subscription.allUserNotifyEnabled") ?? false;
  const templateSubject = watch("subscription.templateSubject") ?? "";
  const templateBody = watch("subscription.templateBody") ?? "";

  if (isFuwari) {
    return (
      <div className="flex flex-col gap-4">
        <div className="fuwari-card-base p-4 sm:p-5 md:p-6 fuwari-onload-animation">
          <div className="flex items-center gap-4 mb-5">
            <div className="h-10 w-10 rounded-xl bg-(--fuwari-btn-regular-bg) flex items-center justify-center shrink-0">
              <BellRing size={18} className="fuwari-text-50" />
            </div>
            <div className="space-y-0.5">
              <h5 className="text-base font-bold fuwari-text-90">
                {m.settings_subscription_title()}
              </h5>
              <p className="text-xs sm:text-sm fuwari-text-50">
                {m.settings_subscription_summary()}
              </p>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-(--fuwari-input-border) bg-(--fuwari-btn-regular-bg) p-4 transition-colors hover:border-(--fuwari-primary)/40">
            <Checkbox
              checked={allUserNotifyEnabled}
              onCheckedChange={(checked) =>
                setValue("subscription.allUserNotifyEnabled", checked, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                })
              }
            />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-bold fuwari-text-90">
                {m.settings_subscription_all_user_label()}
              </p>
              <p className="text-xs sm:text-sm fuwari-text-50 break-all">
                {m.settings_subscription_all_user_desc()}
              </p>
            </div>
          </label>
        </div>

        <div className="fuwari-card-base p-4 sm:p-5 md:p-6 fuwari-onload-animation">
          <label className="block space-y-2">
            <span className="block text-sm font-bold fuwari-text-75">
              {m.settings_subscription_template_subject_label()}
            </span>
            <Input
              id="subscription-template-subject"
              {...register("subscription.templateSubject")}
              value={templateSubject}
              placeholder={m.settings_subscription_template_subject_ph()}
            />
          </label>

          <label className="mt-5 block space-y-2">
            <span className="block text-sm font-bold fuwari-text-75">
              {m.settings_subscription_template_body_label()}
            </span>
            <Textarea
              id="subscription-template-body"
              {...register("subscription.templateBody")}
              value={templateBody}
              placeholder={m.settings_subscription_template_body_ph()}
              rows={10}
              className="min-h-48 font-mono resize-y"
            />
          </label>
          <p className="mt-3 text-xs sm:text-sm fuwari-text-50">
            {m.settings_subscription_template_placeholders_hint()}{" "}
            {SUBSCRIPTION_TEMPLATE_PLACEHOLDERS.map((placeholder, index) => (
              <span key={placeholder}>
                {index > 0 && "、"}
                <code className="px-1.5 py-0.5 rounded-lg bg-(--fuwari-btn-regular-bg) fuwari-text-75 font-mono text-[11px]">
                  {placeholder}
                </code>
              </span>
            ))}
          </p>
          <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-500">
            {m.settings_subscription_mandatory_note()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="border border-border/30 bg-background/50 overflow-hidden divide-y divide-border/20">
        <div className="p-8 space-y-8">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-muted/40 rounded-sm">
              <BellRing size={16} className="text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h5 className="text-sm font-medium text-foreground">
                {m.settings_subscription_title()}
              </h5>
              <p className="text-sm text-muted-foreground">
                {m.settings_subscription_summary()}
              </p>
            </div>
          </div>

          <label className="flex items-center gap-4 border border-border/20 bg-muted/10 p-4 cursor-pointer hover:bg-muted/20 transition-colors">
            <Checkbox
              checked={allUserNotifyEnabled}
              onCheckedChange={(checked) =>
                setValue("subscription.allUserNotifyEnabled", checked, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                })
              }
            />
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {m.settings_subscription_all_user_label()}
              </p>
              <p className="text-sm text-muted-foreground break-all">
                {m.settings_subscription_all_user_desc()}
              </p>
            </div>
          </label>
        </div>

        <div className="p-8 space-y-8">
          <div className="space-y-3">
            <label
              htmlFor="subscription-template-subject"
              className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block"
            >
              {m.settings_subscription_template_subject_label()}
            </label>
            <Input
              id="subscription-template-subject"
              {...register("subscription.templateSubject")}
              value={templateSubject}
              placeholder={m.settings_subscription_template_subject_ph()}
              className="w-full rounded-none border border-border/30 bg-muted/10 px-4 py-5 text-sm text-foreground"
            />
          </div>

          <div className="space-y-3">
            <label
              htmlFor="subscription-template-body"
              className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block"
            >
              {m.settings_subscription_template_body_label()}
            </label>
            <Textarea
              id="subscription-template-body"
              {...register("subscription.templateBody")}
              value={templateBody}
              placeholder={m.settings_subscription_template_body_ph()}
              rows={10}
              className="w-full min-h-48 rounded-none border border-border/30 bg-muted/10 px-4 py-3 text-sm text-foreground font-mono resize-y"
            />
            <p className="text-xs text-muted-foreground">
              {m.settings_subscription_template_placeholders_hint()}{" "}
              {SUBSCRIPTION_TEMPLATE_PLACEHOLDERS.map((placeholder, index) => (
                <span key={placeholder}>
                  {index > 0 && "、"}
                  <code className="px-1.5 py-0.5 rounded bg-muted/60 text-foreground font-mono text-[11px]">
                    {placeholder}
                  </code>
                </span>
              ))}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {m.settings_subscription_mandatory_note()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
