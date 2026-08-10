import { ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { SystemConfig } from "@/features/config/config.schema";
import { m } from "@/paraglide/messages";

export function TurnstileSettingsSection() {
  const { register, setValue, watch } = useFormContext<SystemConfig>();

  const enabled = watch("challenge.turnstile.enabled") ?? false;

  const inputClassName =
    "w-full rounded-none border border-border/30 bg-muted/10 px-4 py-6 text-sm text-foreground transition-all focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10";

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="border border-border/30 bg-background/50 overflow-hidden divide-y divide-border/20">
        {/* Enable toggle */}
        <div className="space-y-6 p-8">
          <label className="flex cursor-pointer items-center gap-4 border border-border/20 bg-muted/10 p-4 transition-colors hover:bg-muted/20">
            <Checkbox
              checked={enabled}
              onCheckedChange={(checked) =>
                setValue("challenge.turnstile.enabled", !!checked, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                })
              }
            />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-foreground">
                {m.settings_turnstile_field_enabled()}
              </p>
              <p className="text-sm text-muted-foreground">
                {m.settings_turnstile_field_enabled_desc()}
              </p>
            </div>
          </label>

          <div className="flex items-start gap-3 border border-border/20 bg-muted/10 p-4">
            <ShieldCheck
              size={14}
              className="mt-0.5 shrink-0 text-muted-foreground"
            />
            <p className="text-sm text-muted-foreground">
              {m.settings_turnstile_scope_note()}
            </p>
          </div>
        </div>

        {/* Credentials */}
        <div className="space-y-8 p-8">
          <div className="flex items-center gap-4">
            <div className="rounded-sm bg-muted/40 p-2">
              <ShieldCheck size={16} className="text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h5 className="text-sm font-medium text-foreground">
                {m.settings_turnstile_creds_title()}
              </h5>
              <p className="text-xs text-muted-foreground">
                {m.settings_turnstile_creds_desc()}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <label
              htmlFor="turnstile-site-key"
              className="text-sm text-muted-foreground"
            >
              {m.settings_turnstile_field_site_key_label()}
            </label>
            <div className="relative group/input">
              <Input
                id="turnstile-site-key"
                placeholder={m.settings_turnstile_field_site_key_ph()}
                {...register("challenge.turnstile.siteKey")}
                className={inputClassName}
              />
            </div>
          </div>

          <div className="space-y-4">
            <label
              htmlFor="turnstile-secret-key"
              className="text-sm text-muted-foreground"
            >
              {m.settings_turnstile_field_secret_key_label()}
            </label>
            <div className="relative group/input">
              <Input
                id="turnstile-secret-key"
                type="password"
                placeholder={m.settings_turnstile_field_secret_key_ph()}
                {...register("challenge.turnstile.secretKey")}
                className={inputClassName}
              />
              <KeyRound
                size={14}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30"
              />
            </div>
          </div>
        </div>

        {/* Doc panel */}
        <div className="space-y-3 p-8">
          <div className="flex items-center gap-3">
            <h5 className="text-sm font-medium text-foreground">
              {m.settings_turnstile_doc_title()}
            </h5>
            <ExternalLink size={12} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {m.settings_turnstile_doc_desc()}
          </p>
        </div>
      </div>
    </div>
  );
}
